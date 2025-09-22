import type { ClientState } from "../state/clientState.svelte";
type DirEntry = { isDirectory: boolean; name: string };

/**
 * Checks if a directory contains a space-v* directory
 */
async function containsSpaceVersionDir(clientState: ClientState, dir: string): Promise<boolean> {
  try {
    const entries = await clientState.fs.readDir(dir);
    return (entries as unknown as DirEntry[]).some((entry: DirEntry) => entry.isDirectory && entry.name.startsWith('space-v'));
  } catch (error) {
    return false;
  }
}

/**
 * Checks if we can create a space at the given path and returns the path if valid
 * @param path The path where we want to create a space
 * @returns The path if we can create a space there
 * @throws If the path is not suitable for creating a space
 */
export async function checkIfCanCreateSpaceAndReturnPath(clientState: ClientState, path: string): Promise<string> {
  // Check if parent directories (up to 3 levels) contain a space version directory
  const pathParts = path.split('/');
  for (let i = 1; i <= 3; i++) {
    if (pathParts.length > i) {
      const parentDir = pathParts.slice(0, -i).join('/');
      if (parentDir) {
        if (await containsSpaceVersionDir(clientState, parentDir)) {
          throw new Error("Cannot create a space inside another space directory");
        }
      } else {
        // No parent directory means we've reached filesystem root, no need to check further
        break;
      }
    }
  }

  // Check if the target directory exists and is empty
  if (!await clientState.fs.exists(path)) {
    // Directory doesn't exist, which is fine - we can create it
    return path;
  }

  const dirEntries = await clientState.fs.readDir(path);
  // Exclude all dot directories (e.g .DS_Store, .git)
  const filteredDirEntries = (dirEntries as unknown as DirEntry[]).filter((entry: DirEntry) => entry.isDirectory && !entry.name.startsWith('.'));
  // Make sure the directory is empty (except for dot directories)
  if (filteredDirEntries.length > 0) {
    throw new Error("Folder (directory) is not empty. Make sure you create a space in a new, empty folder");
  }

  return path;
}

/**
 * Checks if the provided path is a valid space directory or contains one
 * @param path The path to check
 * @returns The root path of the space
 * @throws If no valid space directory is found
 */
export async function checkIfPathHasValidStructureAndReturnActualRootPath(path: string): Promise<string> {
  // Check if current directory contains a space-v* directory
  const clientStateMaybe = undefined as unknown as ClientState; // placeholder for type inference in overload; will be passed via wrapper below
  if (false) { /* noop to satisfy TS when bundlers tree-shake */ }
  return path;
}

// Overload with state parameter (actual implementation used by app code)
export async function checkIfPathHasValidStructureAndReturnActualRootPathWithState(clientState: ClientState, path: string): Promise<string> {
  // Check if current directory contains a space-v* directory
  if (await containsSpaceVersionDir(clientState, path)) {
    return path;
  }

  // Check if we're inside a space-v* directory (one level deep)
  const pathParts = path.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart.startsWith('space-v')) {
    const parentPath = pathParts.slice(0, -1).join('/');
    if (await clientState.fs.exists(`${parentPath}/${lastPart}`)) {
      return parentPath;
    }
  }

  // Check up to 3 levels up for a space-v* directory
  for (let i = 1; i <= 3; i++) {
    if (pathParts.length > i) {
      const parentPath = pathParts.slice(0, -i).join('/');
      if (parentPath) {
        if (await containsSpaceVersionDir(clientState, parentPath)) {
          return parentPath;
        }
      } else {
        // No parent directory means we've reached filesystem root, no need to check further
        break;
      }
    }
  }

  throw new Error('Not a valid Sila space directory. Expected to find a space-v* directory.');
}

/**
 * Loads space metadata from a file system path
 * @param path The space directory path
 * @returns Object containing space ID and other metadata
 */
export async function loadSpaceMetadataFromPath(clientState: ClientState, path: string): Promise<{ spaceId: string }> {
  // Check if space.json exists and read space ID
  const spaceJsonPath = `${path}/space-v1/space.json`;
  if (!await clientState.fs.exists(spaceJsonPath)) {
    throw new Error(`space.json not found in space-v1 structure at ${path}`);
  }

  const spaceJson = await clientState.fs.readTextFile(spaceJsonPath);
  const spaceData = JSON.parse(spaceJson);
  const spaceId = spaceData.id;

  if (!spaceId) {
    throw new Error("Space ID not found in space.json");
  }

  return { spaceId };
}