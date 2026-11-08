const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Admin = require("../models/Admin");
const { getAdminTokenFromRequest } = require("../utils/adminSession");
const { isSuperAdmin } = require("../utils/adminAccess");
const {
  ALLOWED_LEVELS,
  studentOwnLevel,
  assertAdminCommunityLevel,
} = require("../utils/communityAccess");
const {
  trackJoin,
  trackLeave,
  trackAdmin,
  leaveAdmin,
  touchSocket,
  pruneStale,
  emitCommunityPresence,
  roomName,
} = require("../utils/communityPresence");

const HEARTBEAT_PRUNE_MS = 15 * 1000;

function socketRequest(socket) {
  const headerAuth = String(socket.handshake.headers.authorization || "");
  return {
    headers: {
      authorization: headerAuth,
      cookie: socket.handshake.headers.cookie || "",
    },
  };
}

function handshakeToken(socket) {
  const authToken = String(socket.handshake.auth?.token || "").trim();
  if (authToken) return authToken;
  const headerAuth = String(socket.handshake.headers.authorization || "");
  if (headerAuth.toLowerCase().startsWith("bearer ")) {
    return headerAuth.slice(7).trim();
  }
  return "";
}

function isAdminTokenPayload(decoded) {
  if (!decoded || typeof decoded !== "object") return false;
  return (
    decoded.typ === "admin" ||
    decoded.role === "admin" ||
    decoded.role === "super_admin" ||
    decoded.role === "level_admin"
  );
}

async function identifySocket(socket) {
  const token = handshakeToken(socket);
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  if (token) {
    try {
      const decoded = jwt.verify(token, secret);
      const userId = decoded.id || decoded._id;
      if (isAdminTokenPayload(decoded) && userId) {
        const admin = await Admin.findById(userId);
        if (admin && admin.isActive !== false && !admin.invitePending) {
          return { kind: "admin", admin };
        }
      } else if (userId) {
        const student = await Student.findById(userId);
        if (student) return { kind: "student", student };
      }
    } catch {
      /* try cookie next */
    }
  }

  const adminToken = getAdminTokenFromRequest(socketRequest(socket));
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, secret);
      const admin = await Admin.findById(decoded.id || decoded._id);
      if (admin && admin.isActive !== false && !admin.invitePending) {
        return { kind: "admin", admin };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function broadcastPresence(io, level) {
  emitCommunityPresence(io, level);
}

async function joinSocketToLevel(io, socket, level, identity) {
  for (const room of [...socket.rooms]) {
    if (String(room).startsWith("community:")) {
      await socket.leave(room);
    }
  }
  await socket.join(roomName(level));
  socket.data.level = level;
  if (identity?.kind === "student") {
    trackJoin(socket.id, identity.student._id.toString(), level);
  }
  broadcastPresence(io, level);
  socket.emit("community:joined", { level });
}

function attachCommunitySocket(io) {
  io.use(async (socket, next) => {
    try {
      const identity = await identifySocket(socket);
      if (!identity) {
        next(new Error("Authentication required."));
        return;
      }
      socket.data.identity = identity;
      next();
    } catch (error) {
      next(error);
    }
  });

  if (!io._communityPresencePrune) {
    io._communityPresencePrune = setInterval(() => {
      const changed = pruneStale(undefined, io);
      for (const level of changed) broadcastPresence(io, level);
    }, HEARTBEAT_PRUNE_MS);
    if (typeof io._communityPresencePrune.unref === "function") {
      io._communityPresencePrune.unref();
    }
  }

  io.on("connection", (socket) => {
    const identity = socket.data.identity;
    if (!identity) {
      socket.emit("community:error", { message: "Authentication required." });
      socket.disconnect(true);
      return;
    }

    if (identity.kind === "admin") {
      const superAdmin = isSuperAdmin(identity.admin);
      const assignedLevel = identity.admin.assignedLevel || "";
      trackAdmin(socket.id, { isSuper: superAdmin, assignedLevel });
      const levels = superAdmin
        ? ALLOWED_LEVELS
        : assignedLevel
          ? [String(assignedLevel)]
          : [];
      for (const level of levels) broadcastPresence(io, level);
    }

    socket.on("community:join", async (payload = {}) => {
      try {
        let level;
        if (identity.kind === "student") {
          if (identity.student.communityRestricted) {
            socket.emit("community:error", {
              message: "Your community access has been restricted.",
            });
            return;
          }
          level = studentOwnLevel(identity.student);
          const requested = String(payload.level || "").trim();
          if (requested && requested !== level) {
            socket.emit("community:error", {
              message: "You can only join your own level community.",
            });
            return;
          }
        } else {
          level = assertAdminCommunityLevel(identity.admin, payload.level);
        }
        await joinSocketToLevel(io, socket, level, identity);
      } catch (error) {
        socket.emit("community:error", {
          message: error.message || "Could not join community.",
        });
      }
    });

    socket.on("community:heartbeat", () => {
      if (touchSocket(socket.id)) return;
      if (identity.kind !== "student" || identity.student.communityRestricted) {
        return;
      }
      const level = socket.data.level || studentOwnLevel(identity.student);
      if (!level) return;
      trackJoin(socket.id, identity.student._id.toString(), level);
      broadcastPresence(io, level);
    });

    socket.on("community:typing", (payload = {}) => {
      const level = socket.data.level;
      if (!level || identity.kind !== "student") return;
      if (identity.student.communityRestricted) return;
      socket.to(roomName(level)).emit("community:typing", {
        level,
        studentId: identity.student._id.toString(),
        fullName: identity.student.fullName,
        typing: Boolean(payload.typing),
      });
    });

    socket.on("disconnect", () => {
      leaveAdmin(socket.id);
      const left = trackLeave(socket.id);
      if (left?.level) broadcastPresence(io, left.level);
    });

    // Students have exactly one room — join it here so a missed client
    // "community:join" cannot leave them outside the live conversation.
    if (identity.kind === "student" && !identity.student.communityRestricted) {
      try {
        const level = studentOwnLevel(identity.student);
        joinSocketToLevel(io, socket, level, identity).catch((error) => {
          socket.emit("community:error", {
            message: error.message || "Could not join community.",
          });
        });
      } catch (error) {
        socket.emit("community:error", {
          message: error.message || "Could not join community.",
        });
      }
    }
  });
}

module.exports = {
  attachCommunitySocket,
  ALLOWED_LEVELS,
  isSuperAdmin,
};
