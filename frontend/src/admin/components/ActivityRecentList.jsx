import {
  activityDescription,
  activityIcon,
  courseLabel,
  formatActivityDate,
} from "../activity/activityUtils";

function ActivityRecentList({ items, onSelect, compact = true }) {
  if (!items?.length) {
    return (
      <div className="admin-empty">
        <strong>No matching activity</strong>
        Try another filter or clear your search.
      </div>
    );
  }

  return (
    <ul className={`admin-act-list${compact ? " compact" : ""}`}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <button
            type="button"
            className="admin-act-row"
            onClick={() => onSelect(item)}
          >
            <span className="admin-act-row-icon" aria-hidden="true">
              {activityIcon(item)}
            </span>
            <div className="admin-act-row-main">
              <strong>{activityDescription(item)}</strong>
              <span className="admin-act-row-meta">
                {item.student?.fullName || "Unknown student"}
                {item.level ? ` · ${item.level} Level` : ""}
                {" · "}
                {courseLabel(item)}
              </span>
            </div>
            <div className="admin-act-row-side">
              <time dateTime={item.createdAt || undefined}>
                {formatActivityDate(item.createdAt)}
              </time>
              <span className="admin-act-row-chevron" aria-hidden="true">
                ›
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default ActivityRecentList;
