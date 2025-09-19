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
}

import type { AppFileSystem } from "../../appFs";

export type FileStoreProvider = {
	getSpaceRootPath(): string;
	getFs(): AppFileSystem | null;
};

export function createFileStore(provider: FileStoreProvider | null): FileStore | null {
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

function parseDataUrl(dataUrl: string): Uint8Array {
	const match = dataUrl.match(/^data:([^;]*);base64,(.*)$/);
	if (!match) {
		throw new Error("Unsupported data URL format");
	}

	const b64 = match[2];
	let bin: Uint8Array;
	if (typeof Buffer !== "undefined") {
		const buf = Buffer.from(b64, "base64");
		bin = new Uint8Array(buf);
	} else {
		const str = atob(b64);
		const out = new Uint8Array(str.length);
		for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
		bin = out;
	}
	return bin;
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

class FileSystemFileStore implements FileStore {
	constructor(private spaceRoot: string, private fs: AppFileSystem) {}

	async putDataUrl(dataUrl: string): Promise<{ hash: string; size: number }> {
		const data = parseDataUrl(dataUrl);
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
		const base64 = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : btoa(String.fromCharCode(...bytes));
		// mimeType is unknown at CAS level; callers can override if known
		return `data:application/octet-stream;base64,${base64}`;
	}

	async delete(hash: string): Promise<void> {
		// GC is out of scope for Phase 1; no-op
	}

	// Mutable storage methods
	async putMutable(uuid: string, bytes: Uint8Array): Promise<void> {
		const path = makeMutablePath(this.spaceRoot, uuid);
		const handle = await this.fs.create(path);
		await handle.write(bytes);
		await handle.close();
	}

	async getMutable(uuid: string): Promise<Uint8Array> {
		const path = makeMutablePath(this.spaceRoot, uuid);
		return await this.fs.readBinaryFile(path);
	}

	async existsMutable(uuid: string): Promise<boolean> {
		const path = makeMutablePath(this.spaceRoot, uuid);
		return await this.fs.exists(path);
	}

	async deleteMutable(uuid: string): Promise<void> {
		const path = makeMutablePath(this.spaceRoot, uuid);
		if (await this.fs.exists(path)) {
			await this.fs.delete(path);
		}
	}
}