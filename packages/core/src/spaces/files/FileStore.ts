import type { AppFileSystem } from "../../appFs";
import { bytesToDataUrl, dataUrlToBytes } from "./dataUrl";

export interface FileStore {
  // Existing CAS methods (immutable, content-addressed)
  putDataUrl(dataUrl: string): Promise<{ hash: string; size: number }>;
  putBytes(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  exists(hash: string): Promise<boolean>;
  getBytes(hash: string): Promise<Uint8Array>;
  getDataUrl(hash: string): Promise<string>;
  delete(hash: string): Promise<void>;

  // New mutable storage methods (uuid-addressed)
  putMutable(uuid: string, bytes: Uint8Array): Promise<void>;
  getMutable(uuid: string): Promise<Uint8Array>;
  existsMutable(uuid: string): Promise<boolean>;
  deleteMutable(uuid: string): Promise<void>;

  // Helper method for creating mutable copy from immutable file
  createMutableCopyFromHash(
    hash: string,
    uuid?: string,
  ): Promise<{ uuid: string; size: number }>;
}

export type FileStoreProvider = {
	getSpaceRootPath(): string;
	getFs(): AppFileSystem | null;
};

export function createFileStore(
  provider: FileStoreProvider | null,
): FileStore | null {
  if (!provider) return null;
  const fs = provider.getFs();
  if (!fs) return null;
  return new FileSystemFileStore(provider.getSpaceRootPath(), fs);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function sha256(bytes: Uint8Array): Promise<string> {
	// Ensure we pass an ArrayBuffer-backed view compatible with WebCrypto
	const view = new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
	const digest = await crypto.subtle.digest("SHA-256", view);
	return bytesToHex(new Uint8Array(digest));
}

function makeBytesPath(spaceRoot: string, hash: string): string {
	const prefix = hash.slice(0, 2);
	const rest = hash.slice(2);
	return `${spaceRoot}/space-v1/files/static/sha256/${prefix}/${rest}`;
}

function makeMutablePath(spaceRoot: string, uuid: string): string {
	// Split UUID like we do for tree storage: first 2 chars, then the rest
	const prefix = uuid.substring(0, 2);
	const suffix = uuid.substring(2);
	return `${spaceRoot}/space-v1/files/var/uuid/${prefix}/${suffix}`;
}

function isValidSha256Hash(hash: string): boolean {
	return /^[a-f0-9]{64}$/.test(hash);
}

function isValidUuid(uuid: string): boolean {
	// Accept UUIDs with or without hyphens
	// With hyphens: 12345678-1234-1234-1234-123456789abc
	// Without hyphens: 123456781234123412341234123456789abc
	const withHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const withoutHyphens = /^[0-9a-f]{32}$/i;
	return withHyphens.test(uuid) || withoutHyphens.test(uuid);
}

function cleanUuid(uuid: string): string {
	// Remove hyphens if present
	return uuid.replace(/-/g, '');
}

class FileSystemFileStore implements FileStore {
	constructor(private spaceRoot: string, private fs: AppFileSystem) {}

	async putDataUrl(dataUrl: string): Promise<{ hash: string; size: number }> {
		const data = dataUrlToBytes(dataUrl);
		return await this.putBytes(data);
	}

	async putBytes(bytes: Uint8Array): Promise<{ hash: string; size: number }> {
		const hash = await sha256(bytes);
		const path = makeBytesPath(this.spaceRoot, hash);
		if (await this.fs.exists(path)) {
			return { hash, size: bytes.byteLength };
		}
		const handle = await this.fs.create(path);
		await handle.write(bytes);
		await handle.close();
		return { hash, size: bytes.byteLength };
	}

	async exists(hash: string): Promise<boolean> {
		const path = makeBytesPath(this.spaceRoot, hash);
		return await this.fs.exists(path);
	}

	async getBytes(hash: string): Promise<Uint8Array> {
		const path = makeBytesPath(this.spaceRoot, hash);
		return await this.fs.readBinaryFile(path);
	}

	async getDataUrl(hash: string): Promise<string> {
		const bytes = await this.getBytes(hash);
		// mimeType is unknown at CAS level; callers can override if known
		return bytesToDataUrl(bytes);
	}

	async delete(hash: string): Promise<void> {
		// GC is out of scope for Phase 1; no-op
	}

	// Mutable storage methods
	async putMutable(uuid: string, bytes: Uint8Array): Promise<void> {
		// Validate that this is not a SHA256 hash (prevent accidental mutation of immutable files)
		if (isValidSha256Hash(uuid)) {
			throw new Error(`Cannot store SHA256 hash '${uuid}' as mutable file. SHA256 files are immutable. Use putBytes() for immutable storage or generate a new UUID for mutable storage.`);
		}
		
		// Validate UUID format
		if (!isValidUuid(uuid)) {
			throw new Error(`Invalid UUID format: '${uuid}'. Expected UUID format (with or without hyphens).`);
		}
		
		const cleanUuidValue = cleanUuid(uuid);
		const path = makeMutablePath(this.spaceRoot, cleanUuidValue);
		const handle = await this.fs.create(path);
		await handle.write(bytes);
		await handle.close();
	}

	async getMutable(uuid: string): Promise<Uint8Array> {
		// Validate UUID format
		if (!isValidUuid(uuid)) {
			throw new Error(`Invalid UUID format: '${uuid}'. Expected UUID format (with or without hyphens).`);
		}
		
		const cleanUuidValue = cleanUuid(uuid);
		const path = makeMutablePath(this.spaceRoot, cleanUuidValue);
		return await this.fs.readBinaryFile(path);
	}

	async existsMutable(uuid: string): Promise<boolean> {
		// Validate UUID format
		if (!isValidUuid(uuid)) {
			return false; // Invalid UUID format means it doesn't exist
		}
		
		const cleanUuidValue = cleanUuid(uuid);
		const path = makeMutablePath(this.spaceRoot, cleanUuidValue);
		return await this.fs.exists(path);
	}

	async deleteMutable(uuid: string): Promise<void> {
		// Validate UUID format
		if (!isValidUuid(uuid)) {
			return; // Invalid UUID format - nothing to delete
		}
		
		const cleanUuidValue = cleanUuid(uuid);
		const path = makeMutablePath(this.spaceRoot, cleanUuidValue);
		if (await this.fs.exists(path)) {
			await this.fs.delete(path);
		}
	}

	async createMutableCopyFromHash(hash: string, uuid?: string): Promise<{ uuid: string; size: number }> {
		// Validate that this is a valid SHA256 hash
		if (!isValidSha256Hash(hash)) {
			throw new Error(`Invalid SHA256 hash format: '${hash}'. Expected 64 character hexadecimal string.`);
		}
		
		// Check if the immutable file exists
		if (!(await this.exists(hash))) {
			throw new Error(`Immutable file with hash '${hash}' does not exist.`);
		}
		
		// Generate UUID if not provided
		const finalUuid = uuid || crypto.randomUUID();
		
		// Validate the provided UUID if given
		if (uuid && !isValidUuid(uuid)) {
			throw new Error(`Invalid UUID format: '${uuid}'. Expected UUID format (with or without hyphens).`);
		}
		
		// Read the immutable file content
		const bytes = await this.getBytes(hash);
		
		// Store as mutable file
		await this.putMutable(finalUuid, bytes);
		
		return { uuid: finalUuid, size: bytes.byteLength };
	}
}
