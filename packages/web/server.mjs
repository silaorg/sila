import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { getRealtimeHost } from './src/lib/server/realtime-host.js';

const realtime = getRealtimeHost();
if (!realtime)
  throw new Error('Realtime was not initialized by the SvelteKit server.');
const server = createServer((req, res) => {
  void realtime
    .request(req, res)
    .then((handled) => {
      if (!handled) handler(req, res);
    })
    .catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
});
server.on('upgrade', (req, socket, head) => {
  void realtime
    .upgrade(req, socket, head)
    .then((handled) => {
      if (!handled) socket.destroy();
    })
    .catch(() => socket.destroy());
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0');
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close();
  await realtime.close();
  server.closeIdleConnections();
}
process.once('SIGTERM', close);
process.once('SIGINT', close);
