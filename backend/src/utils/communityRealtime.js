const { roomName } = require("./communityPresence");

let ioRef = null;

function setCommunityIo(io) {
  ioRef = io || null;
}

function getCommunityIo(req) {
  if (ioRef) return ioRef;
  if (req?.app?.get) return req.app.get("io") || null;
  return null;
}

/**
 * Broadcast a Community event to everyone currently in a level room.
 * Safe no-op when Socket.IO is not attached yet.
 */
function emitToCommunityLevel(level, event, payload, req = null) {
  const io = getCommunityIo(req);
  const room = roomName(level);
  if (!io || !level || !event) return false;
  const clients = io.sockets.adapter.rooms.get(room)?.size || 0;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[community] ${event} -> ${room} clients=${clients}`);
  }
  io.to(room).emit(event, payload);
  return true;
}

module.exports = {
  setCommunityIo,
  getCommunityIo,
  emitToCommunityLevel,
};
