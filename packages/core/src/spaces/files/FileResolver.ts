import type { Space } from "../Space";

export interface FileReference {
	tree: string;
	vertex: string;
}

export interface ResolvedFileWithData {
	id: string;
	kind: string;
	name?: string;
	alt?: string;
	dataUrl: string;
	mimeType?: string;
	size?: number;
	width?: number;
	height?: number;
}

export interface ResolvedFileInfo {
	id: string;
	name: string;
	mimeType?: string;
	size?: number;
	width?: number;
	height?: number;
	url: string;
	hash: string;
}

export interface ResolvedFileInfoWithKind extends ResolvedFileInfo {
	kind: string;
}

export class FileResolver {
	constructor(private space: Space) {}

	/**
	 * Resolves a single file reference to file information - the reference will contain a URL to the file
	 * Framework-agnostic method for resolving file references
	 */
	async resolveFileReference(fileRef: FileReference): Promise<ResolvedFileInfo | null> {
		try {
			// Validate fileRef before proceeding
			if (!fileRef || !fileRef.tree || !fileRef.vertex) {
				console.warn('Invalid file reference:', fileRef);
				return null;
			}

			// Load the files app tree      
			const filesTree = await this.space.loadAppTree(fileRef.tree);
			if (!filesTree) {
				console.warn(`Files tree not found: ${fileRef.tree}`);
				return null;
			}

			// Get the file vertex
			const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
			if (!fileVertex) {
				console.warn(`File vertex not found: ${fileRef.vertex}`);
				return null;
			}

			// Extract metadata from the file vertex
			const hash = fileVertex.getProperty('hash') as string;
			const name = fileVertex.name;
			const mimeType = fileVertex.getProperty('mimeType') as string;
			const size = fileVertex.getProperty('size') as number;
			const width = fileVertex.getProperty('width') as number;
			const height = fileVertex.getProperty('height') as number;

			if (!hash) {
				console.warn(`File vertex missing hash: ${fileRef.vertex}`);
				return null;
			}

			// Generate sila:// URL instead of loading bytes
			const spaceId = this.space.getId();
			const params: string[] = [];
			if (mimeType) {
				params.push(`type=${encodeURIComponent(mimeType)}`);
			}
			if (name) {
				params.push(`name=${encodeURIComponent(name)}`);
			}
			const query = params.length > 0 ? `?${params.join('&')}` : '';

      // @TODO: we will need to generate a web-based URL if this method runs from the server
      // e.g `api.silain.com/spaces/${spaceId}/files/${hash}${query}`;
			const url = `sila://spaces/${spaceId}/files/${hash}${query}`;

			return {
				id: fileRef.vertex,
				name: name || 'Unknown file',
				mimeType,
				size,
				width,
				height,
				url,
				hash,
			};
		} catch (error) {
			console.error('Failed to resolve file reference:', error);
			return null;
		}
	}

	/**
	 * Resolves multiple file references
	 */
	async getFilesInfo(fileRefs: FileReference[]): Promise<ResolvedFileInfo[]> {
		const resolved: ResolvedFileInfo[] = [];
		
		for (const fileRef of fileRefs) {
			const resolvedFile = await this.resolveFileReference(fileRef);
			if (resolvedFile) {
				resolved.push(resolvedFile);
			}
		}
		
		return resolved;
	}
  
	/**
	 * Resolves file references in attachments to data URLs - so the object itself contains the data
	 * Used for UI rendering and AI consumption
	 */
	async getFileData(fileRefs: FileReference[]): Promise<ResolvedFileWithData[]> {
		if (!fileRefs || fileRefs.length === 0) {
			return [];
		}

		const resolved: ResolvedFileWithData[] = [];
		const fileStore = this.space.getFileStore();

		for (const file of fileRefs) {
			// If has file reference, resolve it
			if (file?.tree && file?.vertex) {
				try {
					const resolvedAttachment = await this.resolveFileReferenceToData(
						file,
						fileStore
					);
					if (resolvedAttachment) {
						resolved.push(resolvedAttachment);
					}
				} catch (error) {
					console.warn("Failed to resolve file reference:", error);
					// Skip attachments that failed to resolve instead of including empty dataUrl
					// This prevents AI from receiving invalid base64 data
				}
				continue;
			}
		}

		return resolved;
	}

	/**
	 * Resolves a single file reference to a data URL for attachments
	 */
	private async resolveFileReferenceToData(
		fileRef: FileReference,
		fileStore: any
	): Promise<ResolvedFileWithData | null> {
		// Load the files app tree
		const filesTree = await this.space.loadAppTree(fileRef.tree);
		if (!filesTree) {
			throw new Error(`Files tree not found: ${fileRef.tree}`);
		}

		// Get the file vertex
		const fileVertex = filesTree.tree.getVertex(fileRef.vertex);
		if (!fileVertex) {
			throw new Error(`File vertex not found: ${fileRef.vertex}`);
		}

		// Get the hash from the file vertex
		const hash = fileVertex.getProperty("hash") as string;
		if (!hash) {
			throw new Error(`File vertex missing hash: ${fileRef.vertex}`);
		}

		// If no FileStore available, we can't load the bytes
		if (!fileStore) {
			throw new Error("FileStore not available for resolving file references");
		}

		// Load the bytes from CAS
		const bytes = await fileStore.getBytes(hash);

		// Get metadata from the file vertex
		const mimeType = fileVertex.getProperty("mimeType") as string;
		const size = fileVertex.getProperty("size") as number;
		const width = fileVertex.getProperty("width") as number;
		const height = fileVertex.getProperty("height") as number;

		// Convert bytes to data URL with proper MIME type
		let base64: string;
		if (typeof Buffer !== "undefined") {
			base64 = Buffer.from(bytes).toString("base64");
		} else {
			// Browser environment - convert Uint8Array to base64 safely
			const binaryString = Array.from(bytes, (byte: number) => String.fromCharCode(byte)).join('');
			base64 = btoa(binaryString);
		}
		const dataUrl = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

		return {
			id: fileRef.vertex,
			kind: mimeType?.startsWith('text/') ? 'text' : (mimeType?.startsWith('image/') ? 'image' : 'file'),
			name: (fileVertex.name as string) || (fileVertex.getProperty("name") as string),
			alt: undefined,
			dataUrl,
			mimeType,
			size,
			width,
			height,
		};
	}
}
