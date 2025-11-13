import type { Vertex } from "reptree";
import { AppTree } from "../AppTree";
import type { AttachmentPreview } from "./AttachmentPreview";
import type { FileInfo } from "./FileInfo";

export class FilesTreeData {
	private static ensureUniqueName(folder: Vertex, desiredName: string): string {
		const baseName = desiredName || "file";
		const childrenNames = new Set(folder.children.map((c) => c.name));
		if (!childrenNames.has(baseName)) {
			return baseName;
		}

		const dotIndex = baseName.lastIndexOf(".");
		const namePart = dotIndex === -1 ? baseName : baseName.slice(0, dotIndex);
		const extPart = dotIndex === -1 ? "" : baseName.slice(dotIndex);

		let counter = 2;
		let candidate = `${namePart} (${counter})${extPart}`;
		while (childrenNames.has(candidate)) {
			counter += 1;
			candidate = `${namePart} (${counter})${extPart}`;
		}
		return candidate;
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
		const hash = fileInfo.hash?.trim();
		if (hash) {
			const existingByHash = folder.children.find((c) => c.getProperty("hash") === hash);
			if (existingByHash) return existingByHash;
		}

		const name = fileInfo.name ?? "file";
		const uniqueName = this.ensureUniqueName(folder, name);
		const mimeType = fileInfo.mimeType;
		const size = fileInfo.size;
		const width = fileInfo.width;
		const height = fileInfo.height;

		return folder.newNamedChild(uniqueName, {
			name: uniqueName,
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
		const normalizedHash = hash?.trim();
		if (normalizedHash) {
			const existingByHash = folder.children.find((c) => c.getProperty("hash") === normalizedHash);
			if (existingByHash) return existingByHash;
		}

		const name = attachment.name ?? "file";
		const uniqueName = this.ensureUniqueName(folder, name);
		const mimeType = attachment.mimeType;
		const size = attachment.size;
		const width = attachment.width;
		const height = attachment.height;

		return folder.newNamedChild(uniqueName, {
			name: uniqueName,
			hash: normalizedHash,
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