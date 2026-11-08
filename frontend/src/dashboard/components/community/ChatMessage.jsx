import { useEffect, useState } from "react";
import CommunityAvatar from "./CommunityAvatar";
import DocumentViewer from "../../../components/pdf/DocumentViewer";
import { objectUrlForBlob, pdfBlob } from "../../../utils/fileBlobs";
import {
  communityFileUrl,
  fetchAuthorizedBlob,
  formatBytes,
  formatMessageTime,
} from "../../../utils/communityApi";
import { adminCommunityFileUrl } from "../../../utils/adminCommunityApi";

function fileUrl(messageId, admin, download = false) {
  return admin
    ? adminCommunityFileUrl(messageId, { download })
    : communityFileUrl(messageId, { download });
}

function ChatAttachment({ message, admin, onOpenImage }) {
  const attachment = message.attachment;
  const [imageSrc, setImageSrc] = useState("");
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  useEffect(() => {
    if (attachment?.kind !== "image") {
      setImageSrc("");
      return undefined;
    }
    let cancelled = false;
    fetchAuthorizedBlob(fileUrl(message.id, admin), { admin })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setImageSrc(url);
      })
      .catch(() => {
        if (!cancelled) setImageSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [admin, attachment?.kind, message.id]);

  if (!attachment) return null;

  if (attachment.kind === "image") {
    return (
      <button
        type="button"
        className="community-image-attach"
        onClick={() => imageSrc && onOpenImage?.(imageSrc)}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={attachment.originalName || "Shared image"} />
        ) : (
          <span>Loading image…</span>
        )}
      </button>
    );
  }

  async function downloadPdf() {
    const blob = await fetchAuthorizedBlob(
      fileUrl(message.id, admin, true),
      { admin }
    );
    const url = URL.createObjectURL(pdfBlob(blob));
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.originalName || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function openPdf() {
    setViewerLoading(true);
    setViewerError("");
    try {
      const blob = await fetchAuthorizedBlob(fileUrl(message.id, admin), {
        admin,
      });
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(objectUrlForBlob(pdfBlob(blob), "application/pdf"));
    } catch (err) {
      setViewerError(err.message || "Could not open that PDF.");
    } finally {
      setViewerLoading(false);
    }
  }

  function closeViewer() {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewerUrl("");
    setViewerError("");
    setViewerLoading(false);
  }

  return (
    <>
      <div className="community-pdf-card">
        <span className="community-pdf-icon" aria-hidden="true">
          PDF
        </span>
        <div>
          <strong>{attachment.originalName || "Document.pdf"}</strong>
          <span>{formatBytes(attachment.size)}</span>
        </div>
        <div className="file-actions community-pdf-actions">
          <button type="button" onClick={openPdf} aria-label="View PDF">
            View
          </button>
          <button type="button" onClick={downloadPdf} aria-label="Download PDF">
            Download
          </button>
        </div>
      </div>
      <DocumentViewer
        open={Boolean(viewerUrl || viewerLoading || viewerError)}
        title={attachment.originalName || "Document.pdf"}
        subtitle="Community PDF"
        format="pdf"
        urls={viewerUrl ? [viewerUrl] : []}
        loading={viewerLoading}
        error={viewerError}
        onClose={closeViewer}
        onDownload={downloadPdf}
      />
    </>
  );
}

function ChatMessage({
  message,
  admin = false,
  onReport,
  onDelete,
  onRestrict,
  onOpenImage,
}) {
  const time = formatMessageTime(message.createdAt);
  const isAdminNote = message.senderKind === "admin";
  const mine = Boolean(message.mine) && !isAdminNote;

  if (isAdminNote) {
    return (
      <article className={`community-admin-note${message.deleted ? " deleted" : ""}`}>
        <div className="community-admin-note-head">
          <span className="community-admin-shield" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6l8-3z" />
              <path d="M9 12l2 2 4-4" strokeLinecap="round" />
            </svg>
          </span>
          <strong>Admin</strong>
          <span>· {time}</span>
          {admin && message.level ? <span>· {message.level} Level</span> : null}
        </div>
        {message.deleted ? (
          <p>This announcement was removed.</p>
        ) : (
          <>
            {message.text ? <p>{message.text}</p> : null}
            <ChatAttachment
              message={message}
              admin={admin}
              onOpenImage={onOpenImage}
            />
          </>
        )}
        {admin && !message.deleted ? (
          <button type="button" className="community-msg-action" onClick={() => onDelete?.(message)}>
            Delete
          </button>
        ) : null}
      </article>
    );
  }

  return (
    <article className={`community-msg ${mine ? "mine" : "theirs"}`}>
      {!mine ? (
        <CommunityAvatar
          studentId={message.senderId}
          name={message.senderName}
          hasAvatar={message.hasAvatar}
          admin={admin}
        />
      ) : null}
      <div className="community-msg-body">
        <div className="community-msg-meta">
          <strong>{mine ? "You" : message.senderName}</strong>
          <span>{time}</span>
          {admin && message.level ? <span>{message.level}L</span> : null}
        </div>
        <div className="community-bubble">
          {message.deleted ? (
            <p className="community-deleted">This message was removed.</p>
          ) : (
            <>
              {message.text ? <p>{message.text}</p> : null}
              <ChatAttachment
                message={message}
                admin={admin}
                onOpenImage={onOpenImage}
              />
            </>
          )}
        </div>
        {!message.deleted ? (
          <div className="community-msg-actions">
            {mine ? <span className="community-sent">Sent</span> : null}
            {!mine && !admin ? (
              <button type="button" onClick={() => onReport?.(message)}>
                Report
              </button>
            ) : null}
            {admin ? (
              <>
                <button type="button" onClick={() => onDelete?.(message)}>
                  Delete
                </button>
                {message.senderId ? (
                  <>
                    <button type="button" onClick={() => onRestrict?.(message, true)}>
                      Restrict
                    </button>
                    <button type="button" onClick={() => onRestrict?.(message, false)}>
                      Restore
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {mine ? (
        <CommunityAvatar
          studentId={message.senderId}
          name={message.senderName}
          hasAvatar={message.hasAvatar}
          admin={admin}
        />
      ) : null}
    </article>
  );
}

export default ChatMessage;
