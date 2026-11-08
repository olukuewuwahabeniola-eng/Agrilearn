/**
 * In-process Socket.IO room broadcast + level isolation checks.
 * Does not require MongoDB or a running AgriLearn server.
 */
const assert = require("assert");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { io: ioc } = require(path.join(
  __dirname,
  "..",
  "..",
  "..",
  "frontend",
  "node_modules",
  "socket.io-client"
));
const {
  setCommunityIo,
  emitToCommunityLevel,
} = require("../utils/communityRealtime");
const { roomName } = require("../utils/communityPresence");

function waitFor(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function connectClient(port, authToken) {
  const socket = ioc(`http://127.0.0.1:${port}`, {
    auth: { token: authToken },
    transports: ["websocket"],
    forceNew: true,
  });
  await waitFor(socket, "connect");
  return socket;
}

async function run() {
  const server = http.createServer();
  const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });
  setCommunityIo(io);

  io.on("connection", (socket) => {
    socket.on("community:join", async (payload = {}) => {
      const level = String(payload.level || "").trim();
      if (!level) {
        socket.emit("community:error", { message: "level required" });
        return;
      }
      for (const room of [...socket.rooms]) {
        if (String(room).startsWith("community:")) {
          await socket.leave(room);
        }
      }
      await socket.join(roomName(level));
      socket.data.level = level;
      socket.emit("community:joined", { level });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const a100 = await connectClient(port, "student-a");
  const b100 = await connectClient(port, "student-b");
  const c200 = await connectClient(port, "student-c");

  const joinedA = waitFor(a100, "community:joined");
  const joinedB = waitFor(b100, "community:joined");
  const joinedC = waitFor(c200, "community:joined");
  a100.emit("community:join", { level: "100" });
  b100.emit("community:join", { level: "100" });
  c200.emit("community:join", { level: "200" });
  await Promise.all([joinedA, joinedB, joinedC]);

  const bGot = waitFor(b100, "community:message");
  let cSawForeign = false;
  c200.on("community:message", () => {
    cSawForeign = true;
  });

  const payload = {
    id: "msg-1",
    level: "100",
    text: "hello realtime",
    type: "text",
  };
  const emitted = emitToCommunityLevel("100", "community:message", payload);
  assert.strictEqual(emitted, true);

  const received = await bGot;
  assert.strictEqual(received.id, "msg-1");
  assert.strictEqual(received.level, "100");

  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.strictEqual(
    cSawForeign,
    false,
    "200-level socket must not receive 100-level messages"
  );

  const updateWait = waitFor(b100, "community:message:update");
  emitToCommunityLevel("100", "community:message:update", {
    id: "msg-1",
    level: "100",
    deleted: true,
  });
  const updated = await updateWait;
  assert.strictEqual(updated.deleted, true);

  a100.close();
  b100.close();
  c200.close();
  setCommunityIo(null);
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));

  console.log("testCommunityRealtime: room broadcast + level isolation passed");
}

run().catch((error) => {
  console.error("testCommunityRealtime failed:", error.message);
  process.exit(1);
});
