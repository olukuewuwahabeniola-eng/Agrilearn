import { io } from "socket.io-client";
import { getApiBaseUrl, getToken } from "./api";
import { getAdminToken } from "./adminApi";

/**
 * Create a Socket.IO client for AgriLearn Community.
 * Polling-first then upgrade: starting on websocket-only often fails
 * cross-origin on localhost (Vite :5173 → API :5000) and on Render proxies.
 */
export function connectCommunitySocket({ admin = false } = {}) {
  const token = admin ? getAdminToken() : getToken();
  return io(getApiBaseUrl(), {
    path: "/socket.io",
    auth: { token: token || "" },
    withCredentials: Boolean(admin),
    transports: ["polling", "websocket"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 20000,
    autoConnect: true,
  });
}

/**
 * Join the authorised Community room. Students omit level (server uses
 * their account level and also auto-joins). Admins must pass the level
 * they are viewing. Retries until community:joined so a missed first
 * emit cannot leave the client outside the room.
 */
export function joinCommunityRoom(socket, level) {
  if (!socket) return () => {};

  let stopped = false;
  let joined = false;
  let attempts = 0;
  let retryTimer = null;

  const join = () => {
    if (stopped || joined) return;
    if (level) socket.emit("community:join", { level: String(level) });
    else socket.emit("community:join", {});
  };

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    if (stopped || joined || attempts >= 10) return;
    attempts += 1;
    retryTimer = setTimeout(() => {
      if (stopped || joined) return;
      if (socket.connected) join();
      scheduleRetry();
    }, Math.min(400 * attempts, 2500));
  };

  const onConnect = () => {
    joined = false;
    attempts = 0;
    join();
    scheduleRetry();
  };

  const onJoined = () => {
    joined = true;
    clearTimeout(retryTimer);
  };

  socket.on("connect", onConnect);
  socket.on("community:joined", onJoined);
  if (socket.connected) onConnect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket.off("connect", onConnect);
    socket.off("community:joined", onJoined);
  };
}
