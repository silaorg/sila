import { protocol, app, net } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { spaceManager } from './spaceManager.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sila',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    }
  }
]);

/**
 * Setup the custom 'sila' protocol for serving files from CAS and builds
 * URL formats:
 *  - sila://builds/desktop/index.html (embedded desktop build)
 *  - sila://builds/desktop/vX.Y.Z/index.html (downloaded versioned desktop build)
 *  - sila://spaces/{spaceId}/files/{hash}?type={mimeType}
 */
export function setupSilaProtocol() {
  // Check if protocol is already handled
  if (protocol.isProtocolHandled('sila')) {
    return;
  }

  protocol.handle('sila', handleSilaRequest);
}

/**
 * Handle a request for the sila:// protocol
 * @param {Request} request 
 * @returns 
 */
async function handleSilaRequest(request) {
  try {
    const url = new URL(request.url);

    const pathParts = url.pathname.split('/').filter(Boolean);

    // Support multiple hosts under sila://
    if (url.hostname === 'builds') {
      const buildsRoot = path.join(app.getPath('userData'), 'builds');
      const embeddedName = `desktop-v${app.getVersion()}`;

      // Helper: list available build folder names
      async function listBuildNames() {
        let entries = [];
        try {
          const dirents = await fs.readdir(buildsRoot, { withFileTypes: true });
          entries = dirents.filter(d => d.isDirectory()).map(d => d.name);
        } catch { }
        return Array.from(new Set([embeddedName, ...entries]));
      }

      if (pathParts.length === 0) {
        const names = await listBuildNames();
        return new Response(JSON.stringify(names), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Support virtual latest endpoint: sila://builds/desktop/index.html
      // If first segment is 'desktop', resolve to highest semver desktop-vX.Y.Z
      let buildName = pathParts[0];
      let rest = pathParts.slice(1).join('/') || 'index.html';
      if (buildName === 'desktop') {
        const names = await listBuildNames();
        const desktopNames = names.filter(n => n.startsWith('desktop-v'));
        function parseSemver(name) {
          const m = name.match(/^desktop-v(\d+)\.(\d+)\.(\d+)$/);
          if (!m) return null;
          return { major: +m[1], minor: +m[2], patch: +m[3] };
        }
        function cmp(a, b) {
          const va = parseSemver(a);
          const vb = parseSemver(b);
          if (!va && !vb) return 0;
          if (!va) return -1;
          if (!vb) return 1;
          if (va.major !== vb.major) return va.major - vb.major;
          if (va.minor !== vb.minor) return va.minor - vb.minor;
          return va.patch - vb.patch;
        }
        const latest = desktopNames.sort(cmp).pop();
        buildName = latest || embeddedName;
      }

      // Determine base directory candidates
      /** @type {string[]} */
      let baseCandidates = [];
      if (buildName === embeddedName) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const appRoot = process.defaultApp ? process.cwd() : app.getAppPath();
        baseCandidates = [appRoot, path.join(appRoot, 'build'), path.join(__dirname, '..', 'build')];
      } else {
        baseCandidates = [path.join(buildsRoot, buildName)];
      }

      // Try to resolve a safe final path similar to electron-serve
      for (const baseDir of baseCandidates) {
        try {
          const directory = baseDir;
          const indexPath = path.join(directory, 'index.html');
          const filePath = path.join(directory, decodeURIComponent('/' + rest).replace(/^\//, ''));

          // Path traversal guard
          const relativePath = path.relative(directory, filePath);
          const isSafe = !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
          if (!isSafe) {
            continue;
          }

          const finalPath = await getServePath(filePath, 'index');
          const fileExtension = path.extname(filePath);

          if (!finalPath && fileExtension && fileExtension !== '.html' && fileExtension !== '.asar') {
            continue;
          }

          const fileUrl = pathToFileURL((finalPath || indexPath));
          const response = await net.fetch(fileUrl.toString());

          if ((finalPath || indexPath).endsWith('.map')) {
            const body = await response.arrayBuffer();
            return new Response(body, {
              status: response.status,
              statusText: response.statusText,
              headers: {
                ...Object.fromEntries(response.headers.entries()),
                'content-type': 'application/json',
              },
            });
          }

          return response;
        } catch { }
      }

      return new Response('Not Found', { status: 404 });
    }

    // Default: spaces
    if (url.hostname !== 'spaces') {
      return new Response('Invalid URL format - expected hostname "builds" or "spaces"', { status: 400 });
    }

    if (pathParts.length !== 3 || pathParts[1] !== 'files') {
      return new Response('Invalid URL format - expected path "/{spaceId}/files/{hash|uuid}"', { status: 400 });
    }

    const spaceId = pathParts[0];
    const identifier = pathParts[2];
    const mimeType = url.searchParams.get('type');
    const downloadName = url.searchParams.get('name');

    // Get space root path
    const spaceRoot = spaceManager.getSpaceRootPath(spaceId);
    if (!spaceRoot) {
      return new Response('Space not found', { status: 404 });
    }

    // Determine if this is a SHA256 hash or UUID and get the appropriate file path
    const filePath = getFilePath(spaceRoot, identifier);
    if (!filePath) {
      return new Response('Invalid identifier format - expected SHA256 hash or UUID', { status: 400 });
    }

    // Check if file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return new Response('File not found', { status: 404 });
    }

    // Check for range requests (for streaming large files)
    const range = request.headers.get('range');
    if (range) {
      // range is non-null inside this block; cast for TS-in-JS checker
      return await handleRangeRequest(filePath, /** @type {string} */(range), mimeType, downloadName);
    }

    // For small files or non-range requests, read the entire file
    const fileBuffer = await fs.readFile(filePath);
    /** @type {Record<string, string>} */
    const headers = {};
    if (mimeType) headers['Content-Type'] = mimeType;
    if (downloadName) headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`;

    return new Response(fileBuffer, { headers });
  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Resolve a path like electron-serve: if it's a directory, return <dir>/<file>.html; if file, return it.
 */
async function getServePath(path_, file) {
  try {
    const stat = await fs.stat(path_);
    if (stat.isFile()) return path_;
    if (stat.isDirectory()) return getServePath(path.join(path_, `${file}.html`), file);
  } catch { }
  return undefined;
}

/**
 * Get the file path for a given identifier (SHA256 hash or UUID)
 * @param {string} spaceRoot - Root path of the space
 * @param {string} identifier - SHA256 hash or UUID
 * @returns {string|null} Full path to the file, or null if invalid format
 */
function getFilePath(spaceRoot, identifier) {
  // Check if it's a SHA256 hash (64 character hex string)
  if (/^[a-f0-9]{64}$/.test(identifier)) {
    return makeBytesPath(spaceRoot, identifier);
  }

  // Check if it's a UUID (with or without hyphens)
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    // Remove hyphens if present
    const cleanUuid = identifier.replace(/-/g, '');
    return makeMutablePath(spaceRoot, cleanUuid);
  }

  return null;
}

/**
 * Construct the file path for a given hash in CAS
 * @param {string} spaceRoot - Root path of the space
 * @param {string} hash - SHA256 hash of the file
 * @returns {string} Full path to the file
 */
function makeBytesPath(spaceRoot, hash) {
  const prefix = hash.slice(0, 2);
  const rest = hash.slice(2);
  return path.join(spaceRoot, 'space-v1', 'files', 'static', 'sha256', prefix, rest);
}

/**
 * Construct the file path for a given UUID in mutable storage
 * @param {string} spaceRoot - Root path of the space
 * @param {string} uuid - UUID of the file (without hyphens)
 * @returns {string} Full path to the file
 */
function makeMutablePath(spaceRoot, uuid) {
  // Split UUID like we do for tree storage: first 2 chars, then the rest
  const prefix = uuid.substring(0, 2);
  const suffix = uuid.substring(2);
  return path.join(spaceRoot, 'space-v1', 'files', 'var', 'uuid', prefix, suffix);
}

/**
 * Handle range requests for streaming large files
 * @param {string} filePath - Path to the file
 * @param {string} rangeHeader - Range header value (e.g., "bytes=0-1023")
 * @param {string | null} mimeType - MIME type of the file
 * @param {string | null} downloadName - Download name of the file
 * @returns {Promise<Response>} Streaming response
 */
async function handleRangeRequest(filePath, rangeHeader, mimeType, downloadName) {
  try {
    // Parse range header: "bytes=0-1023"
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new Response('Invalid range format', { status: 400 });
    }

    const start = parseInt(match[1]);
    const end = match[2] ? parseInt(match[2]) : null;

    // Get file stats
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    // Validate range
    if (start >= fileSize || (end != null && end >= fileSize) || (end != null && start > end)) {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`
        }
      });
    }

    const actualEnd = end != null ? end : (fileSize - 1);
    const contentLength = actualEnd - start + 1;

    // For now, read the range into memory (we'll optimize this later)
    const buffer = await fs.readFile(filePath);
    const rangeBuffer = buffer.slice(start, actualEnd + 1);

    /** @type {Record<string, string>} */
    const headers = {
      'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength.toString()
    };
    if (mimeType) headers['Content-Type'] = mimeType;
    if (downloadName) headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`;

    return new Response(rangeBuffer, {
      status: 206, // Partial Content
      headers
    });

  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
}


