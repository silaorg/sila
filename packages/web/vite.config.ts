import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const configuredApiPort = Number(process.env.HESWE_API_PORT);
const apiPort =
	Number.isInteger(configuredApiPort) &&
	configuredApiPort >= 1024 &&
	configuredApiPort <= 65535
		? configuredApiPort
		: 39900;

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '127.0.0.1',
		port: apiPort,
		strictPort: true
	},
	ssr: {
		external: ['heswe', 'heswe/app-workspace-service']
	}
});
