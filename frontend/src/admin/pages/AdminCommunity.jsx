import { useCallback, useEffect, useRef, useState } from "react";
import DocumentViewer from "../../components/pdf/DocumentViewer";
import ChatMessage from "../../dashboard/components/community/ChatMessage";
import { useDocumentPreview } from "../../hooks/useDocumentPreview";
import { objectUrlForBlob, pdfBlob } from "../../utils/fileBlobs";
import CommunityAvatar from "../../dashboard/components/community/CommunityAvatar";
import MessageComposer from "../../dashboard/components/community/MessageComposer";
import { useAdminAuth } from "../AdminAuthContext";
import {
  deleteAdminCommunityMessage,
  fetchAdminCommunity,
  fetchAdminCommunityAttachments,
  fetchAdminCommunityLog,
  fetchAdminCommunityMessages,
  fetchAdminCommunityOverview,
  fetchAdminCommunityReports,
  postAdminAnnouncement,
  reviewAdminCommunityReport,
  adminCommunityFileUrl,
  searchAdminCommunityMessages,
  setAdminCommunityAccess,
  uploadAdminAnnouncement,
} from "../../utils/adminCommunityApi";
import {
  connectCommunitySocket,
  joinCommunityRoom,
} from "../../utils/communitySocket";
import {
  COMMUNITY_UPLOAD_HINT,
  validateCommunityFile,
} from "../../utils/uploadLimits";
import { fetchAuthorizedBlob, formatMessageTime } from "../../utils/communityApi";
import "../../dashboard/components/community/community.css";

const LEVELS = ["100", "200", "300", "500"];

function AdminCommunity() {
  const { admin } = useAdminAuth();
  const isSuper = Boolean(
    admin?.isSuperAdmin || admin?.role === "super_admin" || admin?.role === "admin"
  );
  const assigned = admin?.assignedLevel || "";
  const [cards, setCards] = useState([]);
  const [level, setLevel] = useState(isSuper ? "100" : assigned);
  const [community, setCommunity] = useState(null);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [showAllOnline, setShowAllOnline] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState(null);
  const [modTab, setModTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lightbox, setLightbox] = useState("");
  const pdfPreview = useDocumentPreview();
  const [pending, setPending] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const threadRef = useRef(null);
  const socketRef = useRef(null);
  const stickBottom = useRef(true);

  const loadOverview = useCallback(async () => {
    const data = await fetchAdminCommunityOverview();
    setCards(data.cards || []);
    if (!isSuper && data.assignedLevel) setLevel(data.assignedLevel);
  }, [isSuper]);

  const loadRoom = useCallback(async (nextLevel) => {
    if (!nextLevel) return;
    const data = await fetchAdminCommunity(nextLevel);
    setCommunity(data.community);
    setOnlineMembers(data.onlineMembers || []);
  }, []);

  const loadMessages = useCallback(async (nextLevel) => {
    if (!nextLevel) return;
    const data = await fetchAdminCommunityMessages(nextLevel);
    setMessages(data.messages || []);
    setHasMore(Boolean(data.hasMore));
    setHits(null);
  }, []);

  const loadModeration = useCallback(async (nextLevel) => {
    if (!nextLevel) return;
    const [reportData, fileData, logData] = await Promise.all([
      fetchAdminCommunityReports({ level: nextLevel, status: "open" }),
      fetchAdminCommunityAttachments(nextLevel),
      fetchAdminCommunityLog({ level: nextLevel }),
    ]);
    setReports(reportData.reports || []);
    setAttachments(fileData.attachments || []);
    setLogs(logData.logs || []);
  }, []);

  useEffect(() => {
    loadOverview().catch((err) => setError(err.message));
  }, [loadOverview]);

  useEffect(() => {
    if (!level) return undefined;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        await Promise.all([
          loadRoom(level),
          loadMessages(level),
          loadModeration(level),
        ]);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load this community.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [level, loadMessages, loadModeration, loadRoom]);

  useEffect(() => {
    if (!level) return undefined;

    const socket = connectCommunitySocket({ admin: true });
    socketRef.current = socket;
    const stopJoin = joinCommunityRoom(socket, level);
    const watchedLevel = level;

    const onMessage = (payload) => {
      const message = payload?.id ? payload : payload?.message;
      if (!message?.id) return;
      if (message.level && message.level !== watchedLevel) return;
      setMessages((current) => {
        if (current.some((row) => row.id === message.id)) {
          return current.map((row) =>
            row.id === message.id ? { ...row, ...message } : row
          );
        }
        return [...current, message];
      });
      stickBottom.current = true;
    };
    socket.on("community:message", onMessage);
    socket.on("community:message:update", onMessage);
    socket.on("community:presence", (payload) => {
      if (payload?.level && payload.level !== watchedLevel) return;
      loadRoom(watchedLevel).catch(() => {});
      loadOverview().catch(() => {});
    });
    socket.on("community:error", (payload) => {
      if (payload?.message) setError(payload.message);
    });

    return () => {
      stopJoin();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [level, loadOverview, loadRoom]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !stickBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!hasMore || !messages[0] || !level) return;
    const el = threadRef.current;
    const prev = el?.scrollHeight || 0;
    const data = await fetchAdminCommunityMessages(level, {
      before: messages[0].id,
    });
    const older = data.messages || [];
    setMessages((current) => {
      const seen = new Set(current.map((row) => row.id));
      return [...older.filter((row) => !seen.has(row.id)), ...current];
    });
    setHasMore(Boolean(data.hasMore));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prev;
    });
  }

  async function handleSend(text) {
    setSending(true);
    setError("");
    try {
      const data = await postAdminAnnouncement(level, text);
      setMessages((current) =>
        current.some((row) => row.id === data.message.id)
          ? current
          : [...current, data.message]
      );
    } catch (err) {
      setError(err.message || "Could not post announcement.");
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
    if (String(file.type || "").startsWith("image/")) {
      setPending({ file, caption, preview: URL.createObjectURL(file) });
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
      const data = await uploadAdminAnnouncement({
        level,
        file,
        text: caption,
        onProgress: setUploadProgress,
      });
      setMessages((current) => [...current, data.message]);
      if (pending?.preview) URL.revokeObjectURL(pending.preview);
      setPending(null);
      setStatusMessage("File shared successfully.");
      loadModeration(level).catch(() => {});
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
      const data = await searchAdminCommunityMessages({
        q,
        level: isSuper ? undefined : level,
      });
      setHits(data.messages || []);
    } catch (err) {
      setError(err.message || "Search failed.");
    }
  }

  async function handleDelete(message) {
    if (!window.confirm("Remove this message from the community?")) return;
    try {
      const data = await deleteAdminCommunityMessage(message.id);
      setMessages((current) =>
        current.map((row) => (row.id === message.id ? { ...row, ...data.item } : row))
      );
      loadModeration(level).catch(() => {});
    } catch (err) {
      setError(err.message || "Could not delete that message.");
    }
  }

  async function handleRestrict(message, restricted = true) {
    let reason = "";
    if (restricted) {
      const entered = window.prompt(
        `Restrict ${message.senderName} from this community?`,
        "Community guidelines"
      );
      if (entered == null) return;
      reason = entered;
    } else if (
      !window.confirm(`Restore community access for ${message.senderName}?`)
    ) {
      return;
    }
    try {
      await setAdminCommunityAccess(message.senderId, {
        restricted,
        reason,
      });
      loadModeration(level).catch(() => {});
    } catch (err) {
      setError(err.message || "Could not update access.");
    }
  }

  const visibleOnline = showAllOnline ? onlineMembers : onlineMembers.slice(0, 7);
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
            <p>Manage and monitor all student communities</p>
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
            placeholder={
              isSuper ? "Search community messages" : "Search this community"
            }
            aria-label="Search community messages"
          />
        </form>
      </div>

      <div className="community-cards">
        {(cards.length ? cards : LEVELS.filter((item) => isSuper || item === assigned).map((item) => ({
          level: item,
          title: `${item} Level`,
          members: 0,
          online: 0,
          active: false,
        }))).map((card) => (
          <button
            type="button"
            key={card.level}
            className={`community-level-card${level === card.level ? " active" : ""}`}
            onClick={() => setLevel(card.level)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="8" r="3" />
              <circle cx="16" cy="9" r="2.4" />
              <path d="M4 18c.8-3 2.8-4.5 5-4.5S13.2 15 14 18" />
            </svg>
            <strong>{card.title}</strong>
            <span>{card.members} members</span>
            <small>
              <span className="community-dot" />
              {card.online > 0 ? "Active" : `${card.online} online`}
            </small>
          </button>
        ))}
      </div>

      <div className="community-banner">
        <div className="community-banner-main">
          <span className="community-people" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="8" r="3" />
              <path d="M4 18c.8-3 2.8-4.5 5-4.5S13.2 15 14 18" />
            </svg>
          </span>
          <div>
            <h2>{community?.title || `${level} Level Community`}</h2>
            <p>
              {community?.members ?? 0} members • {community?.online ?? 0} online
            </p>
          </div>
        </div>
        {isSuper ? (
          <select
            className="community-level-select"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            aria-label="View all levels"
          >
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {item} Level
              </option>
            ))}
          </select>
        ) : (
          <span className="community-online-pill">
            {assigned} Level
          </span>
        )}
      </div>

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

      {pending ? (
        <div className="community-preview">
          <img src={pending.preview} alt="" />
          <strong>Send this image as Admin?</strong>
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

      <div className="community-stage">
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
          {!visibleMessages.length ? (
            <p className="community-empty">No messages in this community yet.</p>
          ) : null}
          {visibleMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              admin
              onDelete={handleDelete}
              onRestrict={handleRestrict}
              onOpenImage={setLightbox}
            />
          ))}
        </div>

        <aside className="community-online-rail open" aria-label="Online members">
          <h3>
            <span className="community-dot" /> Online Now ({onlineMembers.length})
          </h3>
          {visibleOnline.length === 0 ? (
            <p className="community-empty">No students are online in this level.</p>
          ) : (
            visibleOnline.map((member) => (
              <div className="community-member" key={member.id}>
                <span className="community-member-dot">
                  <CommunityAvatar
                    studentId={member.id}
                    name={member.fullName}
                    hasAvatar={member.hasAvatar}
                    admin
                  />
                </span>
                <span>{member.fullName}</span>
              </div>
            ))
          )}
          {onlineMembers.length > 7 ? (
            <button
              type="button"
              className="community-see-more"
              onClick={() => setShowAllOnline((open) => !open)}
            >
              {showAllOnline ? "Show less" : "See more..."}
            </button>
          ) : null}
        </aside>
      </div>

      <MessageComposer
        disabled={sending || !level}
        sending={sending}
        onSend={handleSend}
        onAttach={handleAttach}
        placeholder="Type a message..."
      />

      <div className="community-moderation">
        <div className="community-mod-tabs">
          {["reports", "files", "log"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={modTab === tab ? "active" : undefined}
              onClick={() => setModTab(tab)}
            >
              {tab === "reports"
                ? `Reports (${reports.length})`
                : tab === "files"
                  ? `Shared files (${attachments.length})`
                  : "Moderation log"}
            </button>
          ))}
        </div>

        {modTab === "reports" ? (
          <div className="community-mod-list">
            {reports.length === 0 ? (
              <p className="community-empty">No open reports for this community.</p>
            ) : (
              reports.map((report) => (
                <div className="community-mod-item" key={report.id}>
                  <strong>
                    {report.level} Level · {report.reporter?.fullName || "Student"}
                  </strong>
                  <p>{report.reason}</p>
                  <p>{report.message?.text || report.message?.attachment?.originalName || "Message"}</p>
                  <button
                    type="button"
                    onClick={() =>
                      reviewAdminCommunityReport(report.id, { status: "reviewed" })
                        .then(() => loadModeration(level))
                        .catch((err) => setError(err.message))
                    }
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      reviewAdminCommunityReport(report.id, { status: "dismissed" })
                        .then(() => loadModeration(level))
                        .catch((err) => setError(err.message))
                    }
                  >
                    Dismiss
                  </button>
                  {report.message?.id ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(report.message)}
                    >
                      Delete message
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {modTab === "files" ? (
          <div className="community-mod-list">
            {attachments.length === 0 ? (
              <p className="community-empty">No shared PDFs or images yet.</p>
            ) : (
              attachments.map((item) => (
                <div className="community-mod-item" key={item.id}>
                  <strong>
                    {item.senderName} · {item.level} Level · {item.attachment?.kind}
                  </strong>
                  <p>{item.attachment?.originalName}</p>
                  <span>{formatMessageTime(item.createdAt)}</span>
                  <div className="admin-file-actions">
                    {item.attachment?.kind === "pdf" ? (
                      <button
                        type="button"
                        onClick={() =>
                          pdfPreview.open(item, async (row) => {
                            const blob = await fetchAuthorizedBlob(
                              adminCommunityFileUrl(row.id),
                              { admin: true }
                            );
                            return [
                              objectUrlForBlob(pdfBlob(blob), "application/pdf"),
                            ];
                          })
                        }
                      >
                        View
                      </button>
                    ) : null}
                    <button type="button" onClick={() => handleDelete(item)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {modTab === "log" ? (
          <div className="community-mod-list">
            {logs.length === 0 ? (
              <p className="community-empty">No moderation actions recorded yet.</p>
            ) : (
              logs.map((row) => (
                <div className="community-mod-item" key={row.id}>
                  <strong>{row.action.replace(/_/g, " ")}</strong>
                  <p>{row.summary}</p>
                  <span>
                    {row.adminEmail} · {formatMessageTime(row.createdAt)}
                    {row.level ? ` · ${row.level} Level` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <button
          type="button"
          className="community-lightbox"
          onClick={() => setLightbox("")}
        >
          <img src={lightbox} alt="Shared image" />
        </button>
      ) : null}

      <DocumentViewer
        open={Boolean(pdfPreview.doc)}
        title={pdfPreview.doc?.attachment?.originalName || "Community PDF"}
        subtitle={
          pdfPreview.doc
            ? `${pdfPreview.doc.senderName || "Student"} · ${pdfPreview.doc.level || ""} Level`
            : ""
        }
        format="pdf"
        urls={pdfPreview.urls}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onClose={pdfPreview.close}
      />
    </section>
  );
}

export default AdminCommunity;
