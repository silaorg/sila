import { AppWorkspaceService } from 'heswe/app-workspace-service';
import { publishAppEvent } from './app-events';

let service: AppWorkspaceService | null = null;
let servicePath = '';

export function getWorkspaceService() {
	const workspacePath = process.env.WORKSPACE_PATH ?? process.env.HESWE_WORKSPACE_PATH;
	if (!workspacePath) {
		throw new Error('WORKSPACE_PATH is required for the Heswe server.');
	}
	if (!service || servicePath !== workspacePath) {
		servicePath = workspacePath;
		service = new AppWorkspaceService({
			workspacePath,
			onChange: publishAppEvent
		});
	}
	return service;
}
