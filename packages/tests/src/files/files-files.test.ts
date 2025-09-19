import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Space, SpaceManager, FileSystemPersistenceLayer, createFileStore, FilesTreeData, AttachmentKind } from '@sila/core';
import { NodeFileSystem } from '../setup/setup-node-file-system';
import { FileResolver } from '@sila/core';
import { ChatAppData } from '@sila/core';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makePngDataUrl(): string {
	// 1x1 transparent PNG
	const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=';
	return `data:image/png;base64,${base64}`;
}

describe('Workspace file store (desktop, CAS) saving and loading', () => {
	let tempDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(path.join(tmpdir(), 'sila-files-test-'));
	});

	afterAll(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it('saves a data URL into CAS, creates a file vertex, and loads it back as data URL', async () => {
		const fs = new NodeFileSystem();

		const space = Space.newSpace(crypto.randomUUID());
		const spaceId = space.getId();
		space.name = 'Files Test Space';

		const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		const manager = new SpaceManager();
		await manager.addNewSpace(space, [layer]);

		// Give time to ensure base structure is on disk
		await wait(600);

		// Verify space root structure exists
		await access(path.join(tempDir, 'sila.md'));
		await access(path.join(tempDir, 'space-v1', 'ops'));

		// Create file store bound to this workspace path
		const fileStore = createFileStore({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});
		expect(fileStore).toBeTruthy();

		// Put a small image
		const dataUrl = makePngDataUrl();
		const put = await fileStore!.putDataUrl(dataUrl);
		expect(put.hash).toBeTruthy();
		expect(put.hash.length).toBe(64); // SHA-256 hex string length

		// Bytes roundtrip check
		const origB64 = dataUrl.split(',')[1]!;
		const origBytes = typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(origB64, 'base64')) : (() => { const s = atob(origB64); const u = new Uint8Array(s.length); for (let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; })();
		const loadedBytes = await fileStore!.getBytes(put.hash);
		expect(Buffer.from(loadedBytes)).toEqual(Buffer.from(origBytes));

		// Verify CAS path exists and readable
		const casPath = path.join(tempDir, 'space-v1', 'files', 'sha256', put.hash.slice(0, 2), put.hash.slice(2));
		await access(casPath);
		const raw = await readFile(casPath);
		expect(raw.byteLength).toBeGreaterThan(0);

		// Retrieve as data URL
		const loadedDataUrl = await fileStore!.getDataUrl(put.hash);
		expect(loadedDataUrl.startsWith('data:')).toBe(true);

		// Create a files app tree and link file
		const filesTree = FilesTreeData.createNewFilesTree(space);
		const now = new Date();
		const folder = FilesTreeData.ensureFolderPath(filesTree, [
			now.getUTCFullYear().toString(),
			(String(now.getUTCMonth() + 1)).padStart(2, '0'),
			(String(now.getUTCDate())).padStart(2, '0')
		]);
		const fileVertex = FilesTreeData.saveFileInfo(
			folder,
			{
				name: 'pixel.png',
				hash: put.hash,
				mimeType: 'image/png',
				size: raw.byteLength
			}
		);
		expect(fileVertex.getProperty('hash')).toBe(put.hash);

		// Allow ops to be flushed
		await wait(1200);

		// Validate by loading space ops back
		const loader = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		await loader.connect();
		const ops = await loader.loadSpaceTreeOps();
		expect(ops.length).toBeGreaterThan(0);

		// Load app tree ops
		const appOps = await loader.loadTreeOps(filesTree.getId());
		expect(appOps.length).toBeGreaterThan(0);
	});

	it('resolves file references to data URLs for UI and AI consumption', async () => {
		const fs = new NodeFileSystem();

		const space = Space.newSpace(crypto.randomUUID());
		const spaceId = space.getId();
		space.name = 'File Resolution Test Space';

		const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		const manager = new SpaceManager();
		await manager.addNewSpace(space, [layer]);

		// Give time to ensure base structure is on disk
		await wait(600);

		// Create file store and put an image
		const fileStore = createFileStore({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});
		expect(fileStore).toBeTruthy();

		const dataUrl = makePngDataUrl();
		const put = await fileStore!.putDataUrl(dataUrl);

		// Create a files app tree and file vertex
		const filesTree = FilesTreeData.createNewFilesTree(space);
		const folder = FilesTreeData.ensureFolderPath(filesTree, ['test']);
		const fileVertex = FilesTreeData.saveFileInfo(
			folder,
			{
				name: 'test.png',
				hash: put.hash,
				mimeType: 'image/png',
				size: 68
			}
		);

		// Create a message with file reference (no dataUrl)
		const messageWithFileRef = {
			id: 'msg1',
			role: 'user' as const,
			text: 'Here is an image',
			files: [
				{
					tree: filesTree.getId(), 
					vertex: fileVertex.id
				}
			]
		};

		// Test file resolution
		const fileResolver = new FileResolver(space);
		const resolvedAttachments = await fileResolver.getFileData(messageWithFileRef.files);

		expect(resolvedAttachments).toHaveLength(1);
		expect(resolvedAttachments[0].id).toBeDefined();
		expect(resolvedAttachments[0].kind).toBe('image');
		expect(resolvedAttachments[0].name).toBe('test.png');
		expect(resolvedAttachments[0].dataUrl).toBeTruthy();
		expect(resolvedAttachments[0].dataUrl.startsWith('data:')).toBe(true);
		expect(resolvedAttachments[0].mimeType).toBe('image/png');
		expect(resolvedAttachments[0].size).toBe(68);

		// Test that the resolved dataUrl matches the original
		const resolvedDataUrl = resolvedAttachments[0].dataUrl;
		expect(resolvedDataUrl).toBe(dataUrl);
	});

	it('creates attachments with both file references and transient dataUrl for immediate preview', async () => {
		// Test that when creating a message with attachments, we get both
		// file references (for persistence) and transient dataUrl (for immediate preview)
		
		const space = Space.newSpace(crypto.randomUUID());
		const fs = new NodeFileSystem();
		
		// Connect file store to space
		space.setFileStoreProvider({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});

		// Create a chat app tree
		const appTree = ChatAppData.createNewChatTree(space, 'test-config');
		const chatData = new ChatAppData(space, appTree);

		// Create attachments with dataUrl
		const attachments = [
			{
				id: 'att1',
				kind: 'image' as AttachmentKind,
				name: 'test.png',
				dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
				mimeType: 'image/png',
				size: 68
			}
		];

		// Create a message with attachments
		const message = await chatData.newMessage('user', 'Here is an image', undefined, attachments);

		// Check that the message persists only file references (no dataUrl)
		const messageAttachments = (message as any).files;
		expect(messageAttachments).toHaveLength(1);
		
		const attachment = messageAttachments[0];
		// Now persisted as bare FileReference
		expect(attachment.tree).toBeDefined();
		expect(attachment.vertex).toBeDefined();

		// Verify that the file reference points to a valid file vertex
		const targetTree = await space.loadAppTree(attachment.tree);
		expect(targetTree).toBeDefined();

		// And that resolving attachments returns a usable dataUrl for immediate consumption
		const resolvedMsg = await chatData.resolveMessageFiles(message as any);
		const resolvedAttachment = (resolvedMsg as any).files[0];
		expect(resolvedAttachment.dataUrl).toBe(attachments[0].dataUrl);
	});

	it('creates files app tree with correct appId and name', async () => {
		// Test that files app trees are created with the correct appId and name
		
		const space = Space.newSpace(crypto.randomUUID());
		const filesTree = FilesTreeData.createNewFilesTree(space);
		
		// Check that the app tree has the correct appId
		expect(filesTree.getAppId()).toBe('files');
		
		// Check that the root has the correct name property
		const root = filesTree.tree.root;
		expect(root?.getProperty('name')).toBe('Files');
		
		// Check that the files folder exists
		const filesFolder = filesTree.tree.getVertexByPath('files');
		expect(filesFolder).toBeDefined();
	});

	it('reuses the same default files tree for multiple attachments', async () => {
		// Test that multiple calls to getOrCreateDefaultFilesTree return the same tree
		
		const space = Space.newSpace(crypto.randomUUID());
		
		// First call should create a new tree
		const filesTree1 = await FilesTreeData.getOrCreateDefaultFilesTree(space);
		const treeId1 = filesTree1.getId();
		
		// Second call should return the same tree
		const filesTree2 = await FilesTreeData.getOrCreateDefaultFilesTree(space);
		const treeId2 = filesTree2.getId();
		
		// Third call should also return the same tree
		const filesTree3 = await FilesTreeData.getOrCreateDefaultFilesTree(space);
		const treeId3 = filesTree3.getId();
		
		// All should be the same tree
		expect(treeId1).toBe(treeId2);
		expect(treeId2).toBe(treeId3);
		expect(treeId1).toBe(treeId3);
		
		// Verify it's a files tree
		expect(filesTree1.getAppId()).toBe('files');
		expect(filesTree2.getAppId()).toBe('files');
		expect(filesTree3.getAppId()).toBe('files');
	});

	it('uses the chat app tree by default for multiple messages with attachments', async () => {
		// Test that multiple messages with attachments all use the same chat tree files path by default
		
		const space = Space.newSpace(crypto.randomUUID());
		const fs = new NodeFileSystem();
		
		// Connect file store to space
		space.setFileStoreProvider({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});

		// Create a chat app tree
		const appTree = ChatAppData.createNewChatTree(space, 'test-config');
		const chatData = new ChatAppData(space, appTree);

		// Create attachments
		const attachment1 = {
			id: 'att1',
			kind: 'image' as AttachmentKind,
			name: 'test1.png',
			dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
			mimeType: 'image/png',
			size: 68
		};

		const attachment2 = {
			id: 'att2',
			kind: 'image' as AttachmentKind,
			name: 'test2.png',
			dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9v2e0UAAAAASUVORK5CYII=',
			mimeType: 'image/png',
			size: 68
		};

		// Create first message with attachment
		const message1 = await chatData.newMessage('user', 'First message with image', undefined, [attachment1]);
		
		// Create second message with attachment
		const message2 = await chatData.newMessage('user', 'Second message with image', undefined, [attachment2]);

		// Get the file references from both messages
		const message1Attachments = (message1 as any).files;
		const message2Attachments = (message2 as any).files;
		
		expect(message1Attachments).toHaveLength(1);
		expect(message2Attachments).toHaveLength(1);
		
		// Both should reference the same app tree (the chat tree)
		const treeId1 = message1Attachments[0].tree;
		const treeId2 = message2Attachments[0].tree;
		
		expect(treeId1).toBe(treeId2);
		
		// Verify it's the chat tree (appId 'default-chat')
		const appTreeLoaded = await space.loadAppTree(treeId1);
		expect(appTreeLoaded).toBeDefined();
		expect(appTreeLoaded!.getAppId()).toBe('default-chat');
	});

	it('supports mutable blob storage with UUID addressing', async () => {
		const fs = new NodeFileSystem();

		const space = Space.newSpace(crypto.randomUUID());
		const spaceId = space.getId();
		space.name = 'Mutable Storage Test Space';

		const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		const manager = new SpaceManager();
		await manager.addNewSpace(space, [layer]);

		// Give time to ensure base structure is on disk
		await wait(600);

		// Create file store bound to this workspace path
		const fileStore = createFileStore({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});
		expect(fileStore).toBeTruthy();

		// Test mutable storage operations
		const testUuid = crypto.randomUUID();
		const testData = new TextEncoder().encode('Hello, mutable storage!');
		
		// Initially should not exist
		expect(await fileStore!.existsMutable(testUuid)).toBe(false);
		
		// Store mutable data
		await fileStore!.putMutable(testUuid, testData);
		
		// Should now exist
		expect(await fileStore!.existsMutable(testUuid)).toBe(true);
		
		// Retrieve and verify data
		const retrievedData = await fileStore!.getMutable(testUuid);
		expect(new TextDecoder().decode(retrievedData)).toBe('Hello, mutable storage!');
		expect(retrievedData).toEqual(testData);
		
		// Verify mutable path structure exists
		const mutablePath = path.join(tempDir, 'space-v1', 'files', 'mutable', 'uuid', testUuid);
		await access(mutablePath);
		const raw = await readFile(mutablePath);
		expect(raw).toEqual(Buffer.from(testData));
		
		// Test overwriting (mutable behavior)
		const newData = new TextEncoder().encode('Updated mutable data!');
		await fileStore!.putMutable(testUuid, newData);
		
		const updatedData = await fileStore!.getMutable(testUuid);
		expect(new TextDecoder().decode(updatedData)).toBe('Updated mutable data!');
		expect(updatedData).toEqual(newData);
		
		// Test deletion
		await fileStore!.deleteMutable(testUuid);
		expect(await fileStore!.existsMutable(testUuid)).toBe(false);
	});

	it('supports both immutable CAS and mutable storage simultaneously', async () => {
		const fs = new NodeFileSystem();

		const space = Space.newSpace(crypto.randomUUID());
		const spaceId = space.getId();
		space.name = 'Dual Storage Test Space';

		const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		const manager = new SpaceManager();
		await manager.addNewSpace(space, [layer]);

		// Give time to ensure base structure is on disk
		await wait(600);

		// Create file store bound to this workspace path
		const fileStore = createFileStore({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});
		expect(fileStore).toBeTruthy();

		// Test data
		const immutableData = new TextEncoder().encode('Immutable content');
		const mutableUuid = crypto.randomUUID();
		const mutableData = new TextEncoder().encode('Mutable content');

		// Store in both systems
		const immutableResult = await fileStore!.putBytes(immutableData);
		await fileStore!.putMutable(mutableUuid, mutableData);

		// Verify both exist
		expect(await fileStore!.exists(immutableResult.hash)).toBe(true);
		expect(await fileStore!.existsMutable(mutableUuid)).toBe(true);

		// Verify both can be retrieved
		const retrievedImmutable = await fileStore!.getBytes(immutableResult.hash);
		const retrievedMutable = await fileStore!.getMutable(mutableUuid);

		expect(retrievedImmutable).toEqual(immutableData);
		expect(retrievedMutable).toEqual(mutableData);

		// Verify path structures
		const immutablePath = path.join(tempDir, 'space-v1', 'files', 'sha256', immutableResult.hash.slice(0, 2), immutableResult.hash.slice(2));
		const mutablePath = path.join(tempDir, 'space-v1', 'files', 'mutable', 'uuid', mutableUuid);

		await access(immutablePath);
		await access(mutablePath);

		// Test that identical immutable content gets deduplicated
		const duplicateResult = await fileStore!.putBytes(immutableData);
		expect(duplicateResult.hash).toBe(immutableResult.hash);

		// Test that mutable content can be overwritten (no deduplication)
		const newMutableData = new TextEncoder().encode('New mutable content');
		await fileStore!.putMutable(mutableUuid, newMutableData);
		const finalMutableData = await fileStore!.getMutable(mutableUuid);
		expect(new TextDecoder().decode(finalMutableData)).toBe('New mutable content');
	});

	it('handles mutable storage edge cases', async () => {
		const fs = new NodeFileSystem();

		const space = Space.newSpace(crypto.randomUUID());
		const spaceId = space.getId();
		space.name = 'Mutable Edge Cases Test Space';

		const layer = new FileSystemPersistenceLayer(tempDir, spaceId, fs);
		const manager = new SpaceManager();
		await manager.addNewSpace(space, [layer]);

		// Give time to ensure base structure is on disk
		await wait(600);

		// Create file store bound to this workspace path
		const fileStore = createFileStore({
			getSpaceRootPath: () => tempDir,
			getFs: () => fs
		});
		expect(fileStore).toBeTruthy();

		// Test empty data
		const emptyUuid = crypto.randomUUID();
		await fileStore!.putMutable(emptyUuid, new Uint8Array(0));
		expect(await fileStore!.existsMutable(emptyUuid)).toBe(true);
		const emptyData = await fileStore!.getMutable(emptyUuid);
		expect(emptyData.length).toBe(0);

		// Test large data
		const largeUuid = crypto.randomUUID();
		const largeData = new Uint8Array(1024 * 1024); // 1MB
		for (let i = 0; i < largeData.length; i++) {
			largeData[i] = i % 256;
		}
		await fileStore!.putMutable(largeUuid, largeData);
		const retrievedLargeData = await fileStore!.getMutable(largeUuid);
		expect(retrievedLargeData).toEqual(largeData);

		// Test deleting non-existent mutable blob
		const nonExistentUuid = crypto.randomUUID();
		await expect(fileStore!.deleteMutable(nonExistentUuid)).resolves.not.toThrow();
		expect(await fileStore!.existsMutable(nonExistentUuid)).toBe(false);

		// Test getting non-existent mutable blob
		await expect(fileStore!.getMutable(nonExistentUuid)).rejects.toThrow();
	});
});