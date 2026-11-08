/** In-memory Socket.IO presence. Not a substitute for persisted messages. */

const sockets = new Map(); // socketId -> { studentId, level }
const students = new Map(); // studentId -> { level, sockets: Set }

function trackJoin(socketId, studentId, level) {
  if (!socketId || !studentId || !level) return;
  const id = String(studentId);
  sockets.set(socketId, { studentId: id, level: String(level) });
  const current = students.get(id) || { level: String(level), sockets: new Set() };
  current.level = String(level);
  current.sockets.add(socketId);
  students.set(id, current);
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

function roomName(level) {
  return `community:${level}`;
}

module.exports = {
  trackJoin,
  trackLeave,
  isStudentOnline,
  onlineStudentIdsForLevel,
  onlineCountForLevel,
  roomName,
};
