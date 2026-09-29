import { getRealtimeHost } from '../src/lib/server/realtime-host.js';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin, ViteDevServer } from 'vite';

export function realtimePlugin(): Plugin {
	return {
		name: 'heswe-realtime',
		async closeBundle() { await getRealtimeHost()?.close(); },
		configureServer(server: ViteDevServer) {
			process.env.BETTER_AUTH_URL ??= `http://127.0.0.1:${server.config.server.port}`;
			const handlers = async () => {
				const module = await server.ssrLoadModule('/src/lib/server/realtime.ts');
				return module.initializeRealtime();
			};
			server.middlewares.use((req, res, next) => {
				if (req.url?.split('?')[0] !== '/.neorest') return next();
				void handlers().then((host) => host.request(req, res)).catch(next);
			});
			const upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
				if (req.url?.split('?')[0] !== '/.neorest') return;
				void handlers().then((host) => host.upgrade(req, socket, head)).catch(() => socket.destroy());
			};
			server.httpServer?.on('upgrade', upgrade);
			server.httpServer?.once('close', () => {
				server.httpServer?.off('upgrade', upgrade);
			});
		}
	};
}
