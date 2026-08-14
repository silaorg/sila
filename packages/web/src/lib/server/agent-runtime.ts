import { dev } from '$app/environment';
import {
	ProcessAgentRuntime,
	RunscAgentRuntime,
	assertRunscAvailable,
	readRunscConfiguration,
	type AppAgentRuntime
} from '@heswe/agents';

type Workspace = {
	id: string;
	workspacePath: string;
};

let ready: Promise<void> | null = null;
const PROVIDER_SECRET_NAMES = [
	'ANTHROPIC_API_KEY',
	'COHERE_API_KEY',
	'DEEPSEEK_API_KEY',
	'EXA_API_KEY',
	'FAL_KEY',
	'GOOGLE_API_KEY',
	'GROQ_API_KEY',
	'KIMI_API_KEY',
	'MISTRAL_API_KEY',
	'OPENAI_API_KEY',
	'OPENROUTER_API_KEY',
	'XAI_API_KEY'
] as const;

export function ensureAgentRuntimeReady() {
	if (!ready) {
		ready = checkAgentRuntime();
	}
	return ready;
}

export function createWorkspaceAgentRuntime(workspace: Workspace): AppAgentRuntime {
	const driver = getSandboxDriver();
	if (driver === 'process') {
		return new ProcessAgentRuntime({ workspacePath: workspace.workspacePath });
	}

	const workspaceRoot = process.env.WORKSPACES_PATH;
	if (!workspaceRoot) {
		throw new Error('WORKSPACES_PATH is required for runsc agents.');
	}
	return new RunscAgentRuntime({
		...readRunscConfiguration(),
		workspaceId: workspace.id,
		workspacePath: workspace.workspacePath,
		workspaceRoot
	});
}

async function checkAgentRuntime() {
	if (getSandboxDriver() === 'runsc') {
		const inheritedSecret = PROVIDER_SECRET_NAMES.find((name) => process.env[name]?.trim());
		if (inheritedSecret) {
			throw new Error(
				`${inheritedSecret} must be configured per workspace, not in the production API process.`
			);
		}
		await assertRunscAvailable(readRunscConfiguration());
	}
}

function getSandboxDriver() {
	const configured = process.env.HESWE_SANDBOX_DRIVER?.trim();
	const driver = configured || (dev ? 'process' : 'runsc');
	if (driver !== 'process' && driver !== 'runsc') {
		throw new Error('HESWE_SANDBOX_DRIVER must be process or runsc.');
	}
	if (!dev && driver === 'process') {
		throw new Error('Production agent execution requires HESWE_SANDBOX_DRIVER=runsc.');
	}
	return driver;
}
