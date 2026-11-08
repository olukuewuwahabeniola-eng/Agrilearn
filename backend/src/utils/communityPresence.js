/** In-memory Socket.IO presence. Not a substitute for persisted messages. */

const LEVELS = ["100", "200", "300", "500"];
const STALE_MS = 45 * 1000;

const sockets = new Map(); // socketId -> { studentId, level, lastSeen }
const students = new Map(); // studentId -> { level, sockets: Set }
const admins = new Map(); // socketId -> { isSuper, assignedLevel }

function now() {
  return Date.now();
}

function trackJoin(socketId, studentId, level) {
  if (!socketId || !studentId || !level) return;
  const id = String(studentId);
  const lvl = String(level);
  sockets.set(socketId, { studentId: id, level: lvl, lastSeen: now() });
  const current = students.get(id) || { level: lvl, sockets: new Set() };
  current.level = lvl;
  current.sockets.add(socketId);
  students.set(id, current);
}

function touchSocket(socketId) {
  const meta = sockets.get(socketId);
  if (!meta) return false;
  meta.lastSeen = now();
  return true;
}

function trackLeave(socketId) {
  const meta = sockets.get(socketId);
  if (!meta) return null;
  sockets.delete(socketId);
  const current = students.get(meta.studentId);
  if (!current) return meta;
  current.sockets.delete(socketId);
  if (current.sockets.size === 0) students.delete(meta.studentId);
  return meta;
}

function trackAdmin(socketId, info) {
  if (!socketId) return;
  admins.set(socketId, {
    isSuper: Boolean(info?.isSuper),
    assignedLevel: info?.assignedLevel ? String(info.assignedLevel) : "",
  });
}

function leaveAdmin(socketId) {
  admins.delete(socketId);
}

function isStudentOnline(studentId) {
  const current = students.get(String(studentId));
  return Boolean(current && current.sockets.size > 0);
}

function onlineStudentIdsForLevel(level) {
  const wanted = String(level);
  const ids = [];
  for (const [studentId, info] of students.entries()) {
    if (info.level === wanted && info.sockets.size > 0) ids.push(studentId);
  }
  return ids;
}

function onlineCountForLevel(level) {
  return onlineStudentIdsForLevel(level).length;
}

function onlineCountsByLevel() {
  const counts = { 100: 0, 200: 0, 300: 0, 500: 0 };
  for (const info of students.values()) {
    if (info.sockets.size > 0 && counts[info.level] != null) {
      counts[info.level] += 1;
    }
  }
  return counts;
}

function onlineTotal() {
  let total = 0;
  for (const info of students.values()) {
    if (info.sockets.size > 0) total += 1;
  }
  return total;
}

function pruneStale(maxAgeMs = STALE_MS, io = null) {
  const cutoff = now() - maxAgeMs;
  const changed = new Set();
  for (const [socketId, meta] of sockets.entries()) {
    const stillConnected = io?.sockets?.sockets
      ? io.sockets.sockets.has(socketId)
      : null;
    if (stillConnected) continue;
    const stale = (meta.lastSeen || 0) < cutoff;
    if (stillConnected === false || stale) {
      const left = trackLeave(socketId);
      if (left?.level) changed.add(left.level);
    }
  }
  return [...changed];
}

function presencePayload(level) {
  const lvl = String(level);
  return {
    level: lvl,
    online: onlineCountForLevel(lvl),
  };
}

function emitCommunityPresence(io, level) {
  if (!io || !level) return;
  const payload = presencePayload(level);
  io.to(roomName(level)).emit("community:presence", payload);
  const totals = onlineCountsByLevel();
  for (const [socketId, info] of admins.entries()) {
    const canSee = info.isSuper || info.assignedLevel === payload.level;
    if (!canSee) continue;
    io.to(socketId).emit("community:presence", {
      ...payload,
      totals: info.isSuper ? totals : undefined,
      total: info.isSuper ? onlineTotal() : payload.online,
    });
  }
}

function roomName(level) {
  return `community:${level}`;
}

function resetPresence() {
  sockets.clear();
  students.clear();
  admins.clear();
}

module.exports = {
  LEVELS,
  STALE_MS,
  trackJoin,
  touchSocket,
  trackLeave,
  trackAdmin,
  leaveAdmin,
  isStudentOnline,
  onlineStudentIdsForLevel,
  onlineCountForLevel,
  onlineCountsByLevel,
  onlineTotal,
  pruneStale,
  presencePayload,
  emitCommunityPresence,
  roomName,
  resetPresence,
};
