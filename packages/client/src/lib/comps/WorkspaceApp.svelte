<script lang="ts">
	import {
		createWorkspace,
		createThread,
		getThread,
		listWorkspaces,
		listThreads,
		selectWorkspace,
		sendMessage,
		subscribeToWorkspaceChanges,
		type ThreadDetail,
		type ThreadSummary,
		type WorkspaceSummary
	} from '../api-client';
	import { authClient } from '../auth-client';
	import ConversationView from './ConversationView.svelte';
	import CreateWorkspaceModal from './CreateWorkspaceModal.svelte';
	import WorkspaceSidebar from './WorkspaceSidebar.svelte';

	let { user }: { user: { id: string; name: string; email: string } } = $props();

	let currentWorkspaceId = $state<string | null>(null);
	let workspaces = $state<WorkspaceSummary[]>([]);
	let threads = $state<ThreadSummary[]>([]);
	let selectedThreadId = $state<string | null>(null);
	let thread = $state<ThreadDetail | null>(null);
	let draft = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let switchingWorkspace = $state(false);
	let createWorkspaceOpen = $state(false);
	let errorMessage = $state('');
	let threadDetailRequest = 0;
	let threadListRequest = 0;
	let workspaceLoadRequest = 0;

	$effect(() => {
		void loadInitial();
	});

	$effect(() => {
		return subscribeToWorkspaceChanges((change) => {
			if (change.type === 'workspace.changed') {
				void loadInitial();
				return;
			}
			if (change.workspaceId !== currentWorkspaceId) return;
			void refreshThreads();
			if (change.threadId === selectedThreadId) {
				void refreshSelectedThread();
			}
		});
	});

	async function loadInitial() {
		const request = ++workspaceLoadRequest;
		loading = true;
		errorMessage = '';
		try {
			const loadedWorkspaces = await listWorkspaces();
			if (request !== workspaceLoadRequest) return;
			const workspace =
				loadedWorkspaces.find((item) => item.isCurrent) ?? null;

			const workspaceChanged = currentWorkspaceId !== workspace?.id;
			currentWorkspaceId = workspace?.id ?? null;
			workspaces = loadedWorkspaces;
			if (workspaceChanged) {
				threadListRequest += 1;
				clearThreadSelection();
			}

			if (!workspace) {
				threads = [];
				createWorkspaceOpen = loadedWorkspaces.length === 0;
				return;
			}

			const loadedThreads = await listThreads(workspace.id);
			if (request !== workspaceLoadRequest) return;
			threads = loadedThreads;
			if (threads.length > 0) {
				const selectedStillExists = selectedThreadId
					&& threads.some((item) => item.id === selectedThreadId);
				await selectThread(selectedStillExists ? selectedThreadId! : threads[0].id);
			} else {
				clearThreadSelection();
			}
		} catch (error) {
			if (request === workspaceLoadRequest) setError(error);
		} finally {
			if (request === workspaceLoadRequest) loading = false;
		}
	}

	function clearThreadSelection() {
		threadDetailRequest += 1;
		selectedThreadId = null;
		thread = null;
	}

	async function refreshThreads() {
		const workspaceId = currentWorkspaceId;
		if (!workspaceId) return;
		const request = ++threadListRequest;
		try {
			const loaded = await listThreads(workspaceId);
			if (request === threadListRequest && currentWorkspaceId === workspaceId) {
				threads = loaded;
			}
		} catch (error) {
			if (request === threadListRequest && currentWorkspaceId === workspaceId) {
				setError(error);
			}
		}
	}

	async function refreshSelectedThread() {
		const workspaceId = currentWorkspaceId;
		const threadId = selectedThreadId;
		if (!workspaceId || !threadId) return;
		const request = ++threadDetailRequest;
		try {
			const loaded = await getThread(workspaceId, threadId);
			if (
				request === threadDetailRequest
				&& currentWorkspaceId === workspaceId
				&& selectedThreadId === threadId
			) {
				thread = loaded;
			}
		} catch (error) {
			if (request === threadDetailRequest) {
				setError(error);
			}
		}
	}

	async function selectThread(threadId: string) {
		const workspaceId = currentWorkspaceId;
		if (!workspaceId) return;
		const request = ++threadDetailRequest;
		selectedThreadId = threadId;
		try {
			const loaded = await getThread(workspaceId, threadId);
			if (
				request === threadDetailRequest
				&& currentWorkspaceId === workspaceId
				&& selectedThreadId === threadId
			) {
				thread = loaded;
			}
		} catch (error) {
			if (request === threadDetailRequest) {
				setError(error);
			}
			throw error;
		}
	}

	async function chooseThread(threadId: string) {
		try {
			await selectThread(threadId);
		} catch {}
	}

	async function addThread() {
		if (!currentWorkspaceId) {
			createWorkspaceOpen = true;
			return;
		}
		const workspaceId = currentWorkspaceId;
		try {
			const created = await createThread(workspaceId);
			if (currentWorkspaceId !== workspaceId) return;
			threads = [created, ...threads.filter((thread) => thread.id !== created.id)];
			await selectThread(created.id);
		} catch (error) {
			setError(error);
		}
	}

	async function switchToWorkspace(workspaceId: string) {
		if (workspaceId === currentWorkspaceId || switchingWorkspace) return;
		switchingWorkspace = true;
		errorMessage = '';
		try {
			await selectWorkspace(workspaceId);
			clearThreadSelection();
			threads = [];
			await loadInitial();
		} catch (error) {
			setError(error);
		} finally {
			switchingWorkspace = false;
		}
	}

	async function addWorkspace(name: string) {
		errorMessage = '';
		await createWorkspace(name);
		createWorkspaceOpen = false;
		clearThreadSelection();
		threads = [];
		await loadInitial();
	}

	async function submitMessage(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		const workspaceId = currentWorkspaceId;
		const threadId = selectedThreadId;
		if (!text || !workspaceId || !threadId || sending) return;
		draft = '';
		sending = true;
		errorMessage = '';
		try {
			await sendMessage(workspaceId, threadId, text);
			if (currentWorkspaceId !== workspaceId || selectedThreadId !== threadId) return;
			await Promise.all([refreshThreads(), refreshSelectedThread()]);
		} catch (error) {
			draft = text;
			setError(error);
		} finally {
			sending = false;
		}
	}

	function setError(error: unknown) {
		errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
	}

	async function signOut() {
		try {
			const result = await authClient.signOut();
			if (result.error) {
				throw new Error(result.error.message ?? 'Could not sign out.');
			}
		} catch (error) {
			setError(error);
		}
	}
</script>

<main class="grid min-h-screen bg-surface-50-950 md:grid-cols-[18rem_1fr]">
	<WorkspaceSidebar
		{user}
		{workspaces}
		{currentWorkspaceId}
		{threads}
		{selectedThreadId}
		{loading}
		{switchingWorkspace}
		onSelectWorkspace={switchToWorkspace}
		onCreateWorkspace={() => (createWorkspaceOpen = true)}
		onSelectThread={chooseThread}
		onCreateThread={addThread}
		onSignOut={signOut}
	/>
	<ConversationView
		{thread}
		{currentWorkspaceId}
		{loading}
		{sending}
		{errorMessage}
		bind:draft
		onCreateWorkspace={() => (createWorkspaceOpen = true)}
		onCreateThread={addThread}
		onSubmitMessage={submitMessage}
	/>
</main>

{#if createWorkspaceOpen}
	<CreateWorkspaceModal
		onCreate={addWorkspace}
		onClose={() => (createWorkspaceOpen = false)}
	/>
{/if}
