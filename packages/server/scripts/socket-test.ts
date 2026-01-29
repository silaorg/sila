import { io } from "socket.io-client";

const baseUrl = process.env.SILA_SERVER_URL || "http://localhost:6001";
const spaceId = process.env.SILA_SPACE_ID || process.argv[2];
const token = process.env.SILA_TOKEN || process.argv[3];

if (!spaceId || !token) {
  console.error("Usage: tsx scripts/socket-test.ts <spaceId> <token>");
  process.exit(1);
}

const namespaceUrl = `${baseUrl}/spaces/${spaceId}`;

function makeClient(label: string) {
  return io(namespaceUrl, {
    path: "/socket.io",
    auth: { token },
  }).on("connect_error", (err) => {
    console.error(`[${label}] connect_error`, err.message);
  });
}

const clientA = makeClient("A");
const clientB = makeClient("B");

let readyA = false;
let readyB = false;
let syncedA = false;

function maybeSendOps() {
  if (readyA && readyB && syncedA) {
    clientA.emit("ops:send", {
      treeId: spaceId,
      ops: [],
    });
    clientA.emit("ops:send", {
      treeId: spaceId,
      ops: [{
        id: { peerId: "socket-test", counter: Date.now() },
        targetId: spaceId,
        key: "socketTest",
        value: new Date().toISOString(),
        transient: false,
      }],
    });
  }
}

clientA.on("ready", () => {
  readyA = true;
  clientA.emit("ops:state", { trees: {} });
});

clientB.on("ready", () => {
  readyB = true;
  maybeSendOps();
});

clientA.on("ops:sync", () => {
  syncedA = true;
  maybeSendOps();
});

clientB.on("ops:receive", (payload) => {
  console.log("Received ops payload:", payload);
  clientA.disconnect();
  clientB.disconnect();
  process.exit(0);
});

setTimeout(() => {
  console.error("Timed out waiting for ops:receive");
  clientA.disconnect();
  clientB.disconnect();
  process.exit(1);
}, 5000);
