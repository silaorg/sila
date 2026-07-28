import CreateWorkspaceSwin from './routes/create-workspace-swin.svelte';
import FilePickerSwin from './routes/file-picker-swin.svelte';
import FilesSwin from './routes/files-swin.svelte';
import SettingsSwin from './routes/settings-swin.svelte';
import { Swins } from './swins.svelte';

export const swinsLayout = {
	createWorkspace: {
		key: 'create-workspace',
		target: CreateWorkspaceSwin
	},
	filePicker: {
		key: 'file-picker',
		target: FilePickerSwin
	},
	files: {
		key: 'files',
		target: FilesSwin
	},
	settings: {
		key: 'settings',
		target: SettingsSwin
	}
} as const;

export function setupSwins() {
	const swins = new Swins();
	for (const route of Object.values(swinsLayout)) {
		swins.register(route.key, route.target);
	}
	return swins;
}
