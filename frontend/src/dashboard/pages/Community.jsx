import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import ChatMessage from "../components/community/ChatMessage";
import CommunityAvatar from "../components/community/CommunityAvatar";
import MessageComposer from "../components/community/MessageComposer";
import {
  fetchCommunity,
  fetchCommunityMessages,
  reportCommunityMessage,
  searchCommunityMessages,
  sendCommunityMessage,
  uploadCommunityFile,
} from "../../utils/communityApi";
import {
  connectCommunitySocket,
  joinCommunityRoom,
} from "../../utils/communitySocket";
import {
  COMMUNITY_UPLOAD_HINT,
  validateCommunityFile,
} from "../../utils/uploadLimits";
import "../components/community/community.css";

function studentIdOf(student) {
  return String(student?._id || student?.id || "");
}

function withMine(message, student) {
  const id = studentIdOf(student);
  return {
    ...message,
    mine:
      message.senderKind === "student" &&
      Boolean(id) &&
      String(message.senderId) === id,
  };
}

function upsertMessages(list, incoming, student) {
  const item = withMine(incoming, student);
  const index = list.findIndex((row) => row.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = { ...list[index], ...item };
  return next;
}

function Community() {
  const { student } = useAuth();
  const [community, setCommunity] = useState(null);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState(null);
  const [typing, setTyping] = useState({});
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [lightbox, setLightbox] = useState("");
  const [pending, setPending] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const threadRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimer = useRef(null);
  const stickBottom = useRef(true);
  const studentRef = useRef(student);
  const loadRoomRef = useRef(null);
  studentRef.current = student;

  const myId = studentIdOf(student);

  const loadRoom = useCallback(async () => {
    const data = await fetchCommunity();
    setCommunity(data.community);
    setOnlineMembers(Array.isArray(data.onlineMembers) ? data.onlineMembers : []);
    return data.community;
  }, []);

  const loadMessages = useCallback(async () => {
    const data = await fetchCommunityMessages();
    setMessages((data.messages || []).map((row) => withMine(row, studentRef.current)));
    setHasMore(Boolean(data.hasMore));
  }, []);

  loadRoomRef.current = loadRoom;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const room = await loadRoom();
        if (!room?.restricted) await loadMessages();
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load community.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMessages, loadRoom]);

  useEffect(() => {
    if (!myId) return undefined;

    const socket = connectCommunitySocket();
    socketRef.current = socket;
    const stopJoin = joinCommunityRoom(socket);

    const onMessage = (payload) => {
      const message = payload?.id ? payload : payload?.message;
      if (!message?.id) return;
      setMessages((current) =>
        upsertMessages(current, message, studentRef.current)
      );
      stickBottom.current = true;
    };

    socket.on("community:message", onMessage);
    socket.on("community:message:update", onMessage);
    socket.on("community:presence", (payload) => {
      setCommunity((current) =>
        current ? { ...current, online: payload?.online ?? current.online } : current
      );
      loadRoomRef.current?.().catch(() => {});
    });
    socket.on("community:typing", (payload) => {
      if (!payload?.studentId || payload.studentId === myId) return;
      setTyping((current) => {
        const next = { ...current };
        if (payload.typing) next[payload.studentId] = payload.fullName;
        else delete next[payload.studentId];
        return next;
      });
    });
    socket.on("community:access", (payload) => {
      if (payload?.studentId === myId && payload.restricted) {
        setCommunity((current) =>
          current ? { ...current, restricted: true } : current
        );
        setError("Your community access has been restricted.");
      }
    });
    socket.on("community:error", (payload) => {
      if (payload?.message) setError(payload.message);
    });

    return () => {
      stopJoin();
      clearTimeout(typingTimer.current);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !stickBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const typingLabel = useMemo(() => {
    const names = Object.values(typing);
    if (!names.length) return "";
    if (names.length === 1) return `${names[0]} is typing…`;
    return "Several students are typing…";
  }, [typing]);

  function emitTyping(active) {
    socketRef.current?.emit("community:typing", { typing: active });
    clearTimeout(typingTimer.current);
    if (active) {
      typingTimer.current = setTimeout(() => {
        socketRef.current?.emit("community:typing", { typing: false });
      }, 1400);
    }
  }

  async function loadOlder() {
    if (!hasMore || loadingMore || !messages[0]) return;
    const el = threadRef.current;
    const prev = el?.scrollHeight || 0;
    setLoadingMore(true);
    try {
      const data = await fetchCommunityMessages({ before: messages[0].id });
      const older = (data.messages || []).map((row) => withMine(row, student));
      setMessages((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...older.filter((row) => !seen.has(row.id)), ...current];
      });
      setHasMore(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prev;
      });
    } catch (err) {
      setError(err.message || "Could not load earlier messages.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend(text) {
    setSending(true);
    setError("");
    try {
      const data = await sendCommunityMessage(text);
      setMessages((current) => upsertMessages(current, data.message, student));
      emitTyping(false);
    } catch (err) {
      setError(err.message || "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleAttach(file, caption = "") {
    const invalid = validateCommunityFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    const type = String(file.type || "").toLowerCase();
    if (type.startsWith("image/")) {
      setPending({
        file,
        caption,
        preview: URL.createObjectURL(file),
      });
      return;
    }
    await uploadFile(file, caption);
  }

  async function uploadFile(file, caption = "") {
    setSending(true);
    setError("");
    setStatusMessage("");
    setUploadProgress(0);
    try {
      const data = await uploadCommunityFile({
        file,
        text: caption,
        onProgress: setUploadProgress,
      });
      setMessages((current) => upsertMessages(current, data.message, student));
      if (pending?.preview) URL.revokeObjectURL(pending.preview);
      setPending(null);
      setStatusMessage("File shared successfully.");
    } catch (err) {
      setError(err.message || "Could not share that file.");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    const q = search.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    try {
      const data = await searchCommunityMessages(q);
      setHits((data.messages || []).map((row) => withMine(row, student)));
    } catch (err) {
      setError(err.message || "Search failed.");
    }
  }

  async function handleReport(message) {
    const reason = window.prompt(
      "Why are you reporting this message?",
      "Inappropriate"
    );
    if (!reason) return;
    try {
      const data = await reportCommunityMessage(message.id, reason);
      setError("");
      window.alert(data.message || "Message reported.");
    } catch (err) {
      setError(err.message || "Could not report that message.");
    }
  }

  const restricted = Boolean(community?.restricted);
  const visibleMessages = hits || messages;

  return (
    <section className="community-page">
      <div className="community-head">
        <div className="community-title-row">
          <span className="community-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16v10H7l-3 3V6z" />
            </svg>
          </span>
          <div>
            <h1>Community</h1>
            <p>
              {community?.description ||
                `Chat with other ${student?.level || ""}-level students`}
            </p>
          </div>
        </div>
        <form className="community-search" onSubmit={handleSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="agri-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (!event.target.value.trim()) setHits(null);
            }}
            placeholder="Search messages"
            aria-label="Search messages"
          />
        </form>
      </div>

      <div className="community-banner">
        <div className="community-banner-main">
          <span className="community-people" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="8" r="3" />
              <circle cx="16" cy="9" r="2.4" />
              <path d="M4 18c.8-3 2.8-4.5 5-4.5S13.2 15 14 18M14 18c.6-2.2 2-3.4 4-3.4 1.4 0 2.6.7 3.2 1.8" />
            </svg>
          </span>
          <div>
            <h2>{community?.title || `${student?.level || ""} Level Community`}</h2>
            <p>
              {community?.members ?? 0} members • Online: {community?.online ?? 0}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="community-online-pill"
          onClick={() => setOnlineOpen((open) => !open)}
        >
          <span className="community-dot" />
          Online
        </button>
      </div>

      {restricted ? (
        <p className="community-restricted">
          Your community access has been restricted. You can still update your
          profile picture from Profile, but you cannot send or read live chat.
        </p>
      ) : null}
      {error ? (
        <p className="community-restricted" role="alert">
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="community-status" role="status">
          {statusMessage}
        </p>
      ) : null}
      {uploadProgress != null ? (
        <p className="community-status" role="status">
          Uploading… {uploadProgress}%
        </p>
      ) : null}
      <p className="community-upload-hint">{COMMUNITY_UPLOAD_HINT}</p>

      {onlineOpen ? (
        <div className="community-online-drawer">
          <h3>
            <span className="community-dot" /> Online Now ({onlineMembers.length})
          </h3>
          {onlineMembers.length === 0 ? (
            <p className="community-empty">No classmates are online yet.</p>
          ) : (
            onlineMembers.map((member) => (
              <div className="community-member" key={member.id}>
                <span className="community-member-dot">
                  <CommunityAvatar
                    studentId={member.id}
                    name={member.fullName}
                    hasAvatar={member.hasAvatar}
                  />
                </span>
                <span>{member.fullName}</span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {pending ? (
        <div className="community-preview">
          <img src={pending.preview} alt="" />
          <div>
            <strong>Send this image?</strong>
            <p className="community-empty">{pending.file.name}</p>
          </div>
          <button type="button" onClick={() => uploadFile(pending.file, pending.caption)}>
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(pending.preview);
              setPending(null);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div
        className="community-thread"
        ref={threadRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          if (el.scrollTop < 40) loadOlder();
        }}
      >
        {loading ? <p className="community-empty">Loading community…</p> : null}
        {loadingMore ? <p className="community-empty">Loading earlier messages…</p> : null}
        {!loading && !visibleMessages.length ? (
          <p className="community-empty">No messages yet. Start the conversation.</p>
        ) : null}
        {visibleMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onReport={handleReport}
            onOpenImage={setLightbox}
          />
        ))}
        {typingLabel ? <p className="community-typing">{typingLabel}</p> : null}
      </div>

      <MessageComposer
        disabled={restricted || sending}
        sending={sending}
        onSend={handleSend}
        onAttach={handleAttach}
        onTyping={emitTyping}
      />

      {lightbox ? (
        <button
          type="button"
          className="community-lightbox"
          onClick={() => setLightbox("")}
        >
          <img src={lightbox} alt="Shared image" />
        </button>
      ) : null}
    </section>
  );
}

export default Community;
