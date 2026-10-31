import {
  activityDescription,
  activityIcon,
  courseLabel,
  formatActivityDate,
} from "../activity/activityUtils";

function DetailRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="admin-act-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActivityDetailModal({ item, onClose }) {
  if (!item) return null;

  const isAi = item.category === "ai" || String(item.type || "").startsWith("ai_");
  const isMaterial = item.category === "material";
  const isUpload =
    item.category === "upload" || item.type === "personal_upload";
  const isQuiz = item.kind === "quiz" || item.category === "quiz";

  return (
    <div
      className="admin-act-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="admin-act-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="act-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-act-modal-head">
          <div className="admin-act-modal-title-wrap">
            <span className="admin-act-row-icon" aria-hidden="true">
              {activityIcon(item)}
            </span>
            <div>
              <h2 id="act-detail-title">Activity details</h2>
              <p>{activityDescription(item)}</p>
            </div>
          </div>
          <button type="button" className="admin-act-icon-btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="admin-act-detail-body">
          <DetailRow label="Student" value={item.student?.fullName} />
          <DetailRow label="Email" value={item.student?.email} />
          <DetailRow
            label="Level"
            value={item.level ? `${item.level} Level` : ""}
          />
          <DetailRow label="Course / topic" value={courseLabel(item)} />
          <DetailRow label="Category" value={item.category} />
          <DetailRow label="Type" value={item.type} />
          <DetailRow label="Date & time" value={formatActivityDate(item.createdAt)} />

          {isAi ? (
            <div className="admin-act-privacy-box">
              <strong>AI Assistant (metadata only)</strong>
              <p>
                Private chat transcripts are not shown. This record reflects an
                interaction summary for admin monitoring.
              </p>
              <DetailRow
                label="Action"
                value={item.metadata?.action || item.type?.replace("ai_", "")}
              />
              <DetailRow label="Topic hint" value={item.metadata?.topicHint} />
              <DetailRow
                label="New conversation"
                value={
                  item.metadata?.newConversation === true
                    ? "Yes"
                    : item.metadata?.newConversation === false
                      ? "No"
                      : ""
                }
              />
              {item.relatedId ? (
                <DetailRow label="Conversation ref" value={item.relatedId} />
              ) : null}
            </div>
          ) : null}

          {isMaterial ? (
            <>
              <DetailRow
                label="Resource"
                value={item.metadata?.fileName || item.title}
              />
              <DetailRow label="Library" value={item.metadata?.source} />
              {item.relatedId ? (
                <DetailRow label="Note ID" value={item.relatedId} />
              ) : null}
            </>
          ) : null}

          {isUpload ? (
            <>
              <DetailRow
                label="File"
                value={item.metadata?.fileName || item.title}
              />
              <DetailRow label="Via" value={item.metadata?.via} />
              <DetailRow label="Status" value={item.metadata?.status} />
            </>
          ) : null}

          {isQuiz ? (
            <>
              <DetailRow label="Quiz" value={item.title} />
              <DetailRow
                label="Score"
                value={
                  item.metadata?.score != null
                    ? `${item.metadata.score}${item.metadata.maxScore != null ? ` / ${item.metadata.maxScore}` : ""}`
                    : "Not scored"
                }
              />
              <DetailRow label="Attempt #" value={item.metadata?.attemptNumber} />
              <DetailRow label="Status" value={item.metadata?.status} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ActivityDetailModal;
