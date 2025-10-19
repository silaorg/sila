import type { Vertex } from "reptree";
import { AppTree } from "../AppTree";
import type { Space } from "../Space";
import { FilesAppData } from "./FilesAppData";
import type { AttachmentPreview } from "./AttachmentPreview";
import type { FileInfo } from "./FileInfo";

export class FilesTreeData {
	static createNewFilesTree(space: Space): AppTree {
		return FilesAppData.createNewFilesTree(space);
	}

	static async getOrCreateDefaultFilesTree(space: Space): Promise<AppTree> {
		return FilesAppData.getOrCreateDefaultFilesTree(space);
	}

	static ensureFolderPath(filesTree: AppTree, segments: string[]): Vertex {
		let root = filesTree.tree.getVertexByPath("files");
		if (!root) {
			// Lazily create files root if missing for targeted trees
			root = filesTree.tree.root!.newNamedChild("files") as Vertex;
			root.setProperty("createdAt", Date.now());
		}
		let cur = root as Vertex;
		for (const seg of segments) {
			const found = cur.children.find((c) => c.name === seg);
			if (found) {
				cur = found;
				continue;
			}
			const v = filesTree.tree.newVertex(cur.id, { _n: seg, createdAt: Date.now() });
			cur = v;
		}
		return cur;
	}

	static saveFileInfo(
		folder: Vertex,
		fileInfo: Partial<FileInfo>
	): Vertex {
		const name = fileInfo.name ?? "file";
		const hash = fileInfo.hash ?? "";
		const mimeType = fileInfo.mimeType;
		const size = fileInfo.size;
		const width = fileInfo.width;
		const height = fileInfo.height;

		const existing = folder.children.find((c) => c.getProperty("hash") === hash || c.name === name);
		if (existing) return existing;
		
		return folder.newNamedChild(name, {
			name,
			hash,
			mimeType,
			size,
			width,
			height
		});
	}

	static saveFileInfoFromAttachment(
		folder: Vertex,
		attachment: AttachmentPreview,
		hash: string
	): Vertex {
		const name = attachment.name ?? "file";
		const mimeType = attachment.mimeType;
		const size = attachment.size;
		const width = attachment.width;
		const height = attachment.height;

		const existing = folder.children.find((c) => c.getProperty("hash") === hash || c.name === name);
		if (existing) return existing;
		
		return folder.newNamedChild(name, {
			hash,
			mimeType,
			size,
			width,
			height
		});
	}

	/** Returns normalized file info from a file vertex */
	static getFileInfo(fileVertex: Vertex): FileInfo {
		return {
			name: fileVertex.name ?? '',
			hash: (fileVertex.getProperty('hash') as string) ?? '',
			mimeType: fileVertex.getProperty('mimeType') as string,
			size: fileVertex.getProperty('size') as number,
			width: fileVertex.getProperty('width') as number,
			height: fileVertex.getProperty('height') as number,
		};
	}
}