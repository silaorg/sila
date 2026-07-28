import { AppWorkspaceService } from 'heswe/app-workspace-service';
import { appEvents } from './app-events';

let service: AppWorkspaceService | null = null;

export function getWorkspaceService() {
	if (!service) {
		const workspacePath = process.env.WORKSPACE_PATH ?? process.env.HESWE_WORKSPACE_PATH;
		if (!workspacePath) {
			throw new Error('WORKSPACE_PATH is required for the Heswe server.');
		}
		service = new AppWorkspaceService({
			workspacePath,
			onChange: appEvents.publish
		});
	}
	return service;
}
