/**
 * Unique-student Community presence: multi-tab, leave, stale prune,
 * level isolation, and Super/Level Admin emit scoping.
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
  trackJoin,
  trackLeave,
  trackAdmin,
  leaveAdmin,
  touchSocket,
  onlineCountForLevel,
  onlineCountsByLevel,
  onlineTotal,
  pruneStale,
  emitCommunityPresence,
  resetPresence,
  roomName,
} = require("../utils/communityPresence");

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

function createFakeIo() {
  const emits = [];
  return {
    emits,
    to(room) {
      return {
        emit(event, payload) {
          emits.push({ room, event, payload });
        },
      };
    },
  };
}

function runUnitChecks() {
  resetPresence();

  trackJoin("sock-a1", "student-a", "100");
  trackJoin("sock-a2", "student-a", "100");
  trackJoin("sock-b1", "student-b", "100");
  trackJoin("sock-c1", "student-c", "200");

  assert.strictEqual(onlineCountForLevel("100"), 2, "two unique 100-level students");
  assert.strictEqual(onlineCountForLevel("200"), 1);
  assert.strictEqual(onlineTotal(), 3, "do not double-count tabs");
  assert.deepStrictEqual(onlineCountsByLevel(), {
    100: 2,
    200: 1,
    300: 0,
    500: 0,
  });

  trackLeave("sock-a1");
  assert.strictEqual(onlineCountForLevel("100"), 2, "other tab still online");
  assert.strictEqual(onlineTotal(), 3);

  trackLeave("sock-a2");
  assert.strictEqual(onlineCountForLevel("100"), 1);
  assert.ok(!touchSocket("sock-a2"));
  assert.ok(touchSocket("sock-b1"));

  const io = createFakeIo();
  trackAdmin("super-1", { isSuper: true });
  trackAdmin("level-100", { isSuper: false, assignedLevel: "100" });
  trackAdmin("level-200", { isSuper: false, assignedLevel: "200" });

  emitCommunityPresence(io, "100");
  const rooms = io.emits.filter((row) => row.event === "community:presence");
  assert.ok(rooms.some((row) => row.room === roomName("100") && row.payload.online === 1));
  const superEmit = rooms.find((row) => row.room === "super-1");
  assert.ok(superEmit, "super admin receives presence");
  assert.strictEqual(superEmit.payload.total, 2);
  assert.strictEqual(superEmit.payload.totals["100"], 1);
  assert.strictEqual(superEmit.payload.totals["200"], 1);
  assert.ok(rooms.some((row) => row.room === "level-100"));
  assert.ok(
    !rooms.some((row) => row.room === "level-200"),
    "200-level admin must not receive 100-level presence"
  );

  leaveAdmin("level-200");
  resetPresence();
  trackJoin("old-sock", "student-z", "300");
  const disconnectedIo = { sockets: { sockets: new Map() } };
  const changed = pruneStale(undefined, disconnectedIo);
  assert.ok(changed.includes("300"));
  assert.strictEqual(onlineCountForLevel("300"), 0);

  trackJoin("live-sock", "student-y", "500");
  const connectedIo = {
    sockets: { sockets: new Map([["live-sock", {}]]) },
  };
  assert.deepStrictEqual(pruneStale(undefined, connectedIo), []);
  assert.strictEqual(onlineCountForLevel("500"), 1);

  console.log("testCommunityPresence: unique counts + admin scoping passed");
}

async function connectClient(port) {
  const socket = ioc(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
  await waitFor(socket, "connect");
  return socket;
}

async function runSocketChecks() {
  resetPresence();
  const server = http.createServer();
  const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.on("community:join", async (payload = {}) => {
      const level = String(payload.level || "").trim();
      const studentId = String(payload.studentId || "").trim();
      if (!level || !studentId) {
        socket.emit("community:error", { message: "join required" });
        return;
      }
      await socket.join(roomName(level));
      trackJoin(socket.id, studentId, level);
      emitCommunityPresence(io, level);
      socket.emit("community:joined", { level });
    });
    socket.on("disconnect", () => {
      const left = trackLeave(socket.id);
      if (left?.level) emitCommunityPresence(io, left.level);
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const tabA = await connectClient(port);
  const tabB = await connectClient(port);
  const peer = await connectClient(port);
  const otherLevel = await connectClient(port);

  const joinedA = waitFor(tabA, "community:joined");
  const joinedB = waitFor(tabB, "community:joined");
  const joinedPeer = waitFor(peer, "community:joined");
  const joinedOther = waitFor(otherLevel, "community:joined");

  tabA.emit("community:join", { level: "100", studentId: "same-student" });
  tabB.emit("community:join", { level: "100", studentId: "same-student" });
  peer.emit("community:join", { level: "100", studentId: "peer-student" });
  otherLevel.emit("community:join", { level: "200", studentId: "other-level" });
  await Promise.all([joinedA, joinedB, joinedPeer, joinedOther]);

  assert.strictEqual(onlineCountForLevel("100"), 2);
  assert.strictEqual(onlineCountForLevel("200"), 1);
  assert.strictEqual(onlineTotal(), 3);

  let otherSaw100 = false;
  otherLevel.on("community:presence", (payload) => {
    if (payload?.level === "100") otherSaw100 = true;
  });

  const peerPresence = waitFor(peer, "community:presence");
  tabA.close();
  const afterTabClose = await peerPresence;
  assert.strictEqual(afterTabClose.level, "100");
  assert.strictEqual(afterTabClose.online, 2, "second tab still counts as one person");

  const peerAfterLeave = waitFor(peer, "community:presence");
  tabB.close();
  const afterBothTabs = await peerAfterLeave;
  assert.strictEqual(afterBothTabs.online, 1);

  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(otherSaw100, false, "200-level must not see 100-level presence");

  peer.close();
  otherLevel.close();
  resetPresence();
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));

  console.log("testCommunityPresence: socket multi-tab + level isolation passed");
}

async function run() {
  runUnitChecks();
  await runSocketChecks();
}

run().catch((error) => {
  console.error("testCommunityPresence failed:", error.message);
  process.exit(1);
});
