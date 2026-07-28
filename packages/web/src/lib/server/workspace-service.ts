import { AppWorkspaceError, AppWorkspaceService } from 'heswe/app-workspace-service';
import { appEvents } from './app-events';
import { getDatabase } from './database';
import { WorkspaceRegistry } from './workspace-registry.js';

type RegisteredWorkspace = {
	id: string;
	name: string;
	workspacePath: string;
	createdAt: string;
};

let registry: WorkspaceRegistry | null = null;
const services = new Map<string, AppWorkspaceService>();

export function listWorkspaces(userId: string) {
	return getWorkspaceRegistry().list(userId);
}

export function createWorkspace(userId: string, input: { name?: unknown }) {
	return getWorkspaceRegistry().create(userId, input);
}

export function selectWorkspace(userId: string, workspaceId: string) {
	return getWorkspaceRegistry().select(userId, workspaceId);
}

export async function getCurrentWorkspace(userId: string) {
	return getWorkspaceRegistry().getCurrent(userId);
}

export async function getWorkspaceContext(userId: string) {
	const workspace = await getCurrentWorkspace(userId);
	if (!workspace) {
		throw new AppWorkspaceError('not_found', 'Create a workspace first.');
	}
	return {
		workspace,
		service: getService(workspace)
	};
}

function getWorkspaceRegistry() {
	if (registry) return registry;

	const workspacesPath = process.env.WORKSPACES_PATH;
	if (!workspacesPath) {
		throw new Error('WORKSPACES_PATH is required for the Heswe server.');
	}
	registry = new WorkspaceRegistry({
		database: getDatabase(),
		workspacesPath
	});
	return registry;
}

function getService(workspace: RegisteredWorkspace) {
	let service = services.get(workspace.id);
	if (service) return service;

	service = new AppWorkspaceService({
		workspacePath: workspace.workspacePath,
		onChange: appEvents.publish
	});
	services.set(workspace.id, service);
	return service;
}
