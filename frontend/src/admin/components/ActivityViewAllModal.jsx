import { FILTER_TABS, LEVELS } from "../activity/activityUtils";
import ActivityRecentList from "./ActivityRecentList";

function ActivityViewAllModal({
  open,
  onClose,
  filterId,
  onFilterChange,
  level,
  onLevelChange,
  courseCode,
  onCourseCodeChange,
  courseOptions,
  studentQ,
  onStudentQChange,
  from,
  onFromChange,
  to,
  onToChange,
  onClearFilters,
  items,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
  onSelectItem,
}) {
  if (!open) return null;

  return (
    <div
      className="admin-act-modal-backdrop admin-act-viewall-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="admin-act-modal admin-act-viewall"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-all-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-act-modal-head">
          <div>
            <h2 id="view-all-title">All activity history</h2>
            <p className="admin-muted">
              Search and filter the complete student activity log.
            </p>
          </div>
          <button type="button" className="admin-act-icon-btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="admin-act-viewall-filters">
          <div className="admin-act-filter-pills" role="tablist">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filterId === tab.id}
                className={filterId === tab.id ? "active" : ""}
                onClick={() => onFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="admin-act-advanced-grid">
            <div className="admin-field">
              <label htmlFor="viewall-student-q">Student name or email</label>
              <input
                id="viewall-student-q"
                type="search"
                className="agri-search"
                value={studentQ}
                onChange={(e) => onStudentQChange(e.target.value)}
                placeholder="Search student…"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="viewall-level">Level</label>
              <select
                id="viewall-level"
                value={level}
                onChange={(e) => onLevelChange(e.target.value)}
              >
                <option value="">All levels</option>
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="viewall-course">Course</label>
              <select
                id="viewall-course"
                value={courseCode}
                onChange={(e) => onCourseCodeChange(e.target.value)}
              >
                <option value="">All courses</option>
                {courseOptions.map((c) => (
                  <option key={`${c.level}-${c.code}`} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="viewall-from">From</label>
              <input
                id="viewall-from"
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="viewall-to">To</label>
              <input
                id="viewall-to"
                type="date"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-act-toolbar-actions">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          </div>
        </div>

        {error ? <p className="admin-form-error">{error}</p> : null}
        {loading ? <p className="admin-muted">Loading activity…</p> : null}

        {!loading ? (
          <ActivityRecentList
            items={items}
            onSelect={onSelectItem}
            compact={false}
          />
        ) : null}

        {totalPages > 1 ? (
          <footer className="admin-act-pagination">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <span className="admin-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export default ActivityViewAllModal;
