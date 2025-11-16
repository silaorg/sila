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
		const storageId = (fileInfo.id ?? fileInfo.hash)?.trim();
		if (storageId) {
			const existing = folder.children.find((c) =>
				c.getProperty("hash") === storageId || c.getProperty("id") === storageId
			);
			if (existing) return existing;
		}

		const name = fileInfo.name ?? "file";
		const uniqueName = this.ensureUniqueName(folder, name);
		const mimeType = fileInfo.mimeType;
		const size = fileInfo.size;
		const width = fileInfo.width;
		const height = fileInfo.height;

		const props: Record<string, any> = {
			name: uniqueName,
			mimeType,
			size,
			width,
			height
		};

		if (fileInfo.hash) {
			props.hash = fileInfo.hash.trim();
		}
		if (fileInfo.id) {
			props.id = fileInfo.id.trim();
		}

		return folder.newNamedChild(uniqueName, props);
	}

	static saveFileInfoFromAttachment(
		folder: Vertex,
		attachment: AttachmentPreview,
		storageId: string
	): Vertex {
		const normalizedId = storageId?.trim();
		if (normalizedId) {
			const existing = folder.children.find(
				(c) =>
					c.getProperty("hash") === normalizedId ||
					c.getProperty("id") === normalizedId
			);
			if (existing) return existing;
		}

		const name = attachment.name ?? "file";
		const uniqueName = this.ensureUniqueName(folder, name);
		const mimeType = attachment.mimeType;
		const size = attachment.size;
		const width = attachment.width;
		const height = attachment.height;

		const props: Record<string, any> = {
			name: uniqueName,
			mimeType,
			size,
			width,
			height
		};

		// For text attachments we treat storageId as a mutable UUID (`id`); for others as CAS `hash`.
		if (attachment.kind === "text") {
			props.id = normalizedId;
		} else {
			props.hash = normalizedId;
		}

		return folder.newNamedChild(uniqueName, props);
	}

	/** Returns normalized file info from a file vertex */
	static getFileInfo(fileVertex: Vertex): FileInfo {
		const hash = fileVertex.getProperty('hash') as string | undefined;
		const id = fileVertex.getProperty('id') as string | undefined;
		return {
			name: fileVertex.name ?? '',
			hash: hash,
			id: id,
			mimeType: fileVertex.getProperty('mimeType') as string,
			size: fileVertex.getProperty('size') as number,
			width: fileVertex.getProperty('width') as number,
			height: fileVertex.getProperty('height') as number,
		};
	}
}