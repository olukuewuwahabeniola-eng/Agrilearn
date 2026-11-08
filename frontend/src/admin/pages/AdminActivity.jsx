import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";
import { FILTER_TABS, LEVELS } from "../activity/activityUtils";
import {
  canLoadMore,
  fetchActiveStudentsToday,
  fetchActivityFeed,
  fetchActivityOverview,
} from "../activity/fetchActivityFeed";
import ActivityDetailModal from "../components/ActivityDetailModal";
import ActivityRecentList from "../components/ActivityRecentList";
import ActivityViewAllModal from "../components/ActivityViewAllModal";

const RECENT_PAGE_SIZE = 8;
const VIEW_ALL_PAGE_SIZE = 20;
const OVERVIEW_REFRESH_MS = 45000;

function AdminActivity() {
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const [filterId, setFilterId] = useState("all");
  const [level, setLevel] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [studentQ, setStudentQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [items, setItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [featureStatus, setFeatureStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllPage, setViewAllPage] = useState(1);
  const [viewAllItems, setViewAllItems] = useState([]);
  const [viewAllLoading, setViewAllLoading] = useState(false);
  const [viewAllError, setViewAllError] = useState("");
  const [viewAllTotalPages, setViewAllTotalPages] = useState(1);

  const [detailItem, setDetailItem] = useState(null);
  const [activeTodayOpen, setActiveTodayOpen] = useState(false);
  const [activeTodayStudents, setActiveTodayStudents] = useState([]);
  const [activeTodayLoading, setActiveTodayLoading] = useState(false);
  const [activeTodayError, setActiveTodayError] = useState("");

  const [courseCatalog, setCourseCatalog] = useState(null);

  const courseOptions = useMemo(() => {
    if (!courseCatalog?.byLevel) return [];
    const list = [];
    for (const lvl of LEVELS) {
      const courses = courseCatalog.byLevel[lvl] || [];
      for (const c of courses) {
        if (!level || level === lvl) {
          list.push({ level: lvl, code: c.code, title: c.title });
        }
      }
    }
    return list;
  }, [courseCatalog, level]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchActivityOverview();
      setOverview(data);
      setOverviewError("");
    } catch (err) {
      setOverviewError(err.message || "Could not load summary statistics.");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const timer = setInterval(loadOverview, OVERVIEW_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadOverview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch("/api/admin/courses");
        if (!cancelled) setCourseCatalog(data);
      } catch {
        if (!cancelled) setCourseCatalog(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const feedFilters = useMemo(
    () => ({ filterId, level, courseCode, studentQ, from, to }),
    [filterId, level, courseCode, studentQ, from, to]
  );

  useEffect(() => {
    setPage(1);
  }, [feedFilters]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setFeedLoading(true);
      setFeedError("");
      try {
        const result = await fetchActivityFeed({
          ...feedFilters,
          page: 1,
          limit: RECENT_PAGE_SIZE * page,
        });
        if (cancelled) return;
        setItems(result.items);
        setTotalCount(result.total);
        setHasMore(canLoadMore({ total: result.total, loadedCount: result.items.length }));
        setFeatureStatus(result.featureStatus || "");
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setFeedError(err.message || "Could not load activity.");
        }
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }, studentQ ? 320 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [feedFilters, page, studentQ]);

  useEffect(() => {
    if (!viewAllOpen) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setViewAllLoading(true);
      setViewAllError("");
      try {
        const result = await fetchActivityFeed({
          ...feedFilters,
          page: viewAllPage,
          limit: VIEW_ALL_PAGE_SIZE,
        });
        if (cancelled) return;
        setViewAllItems(result.items);
        setViewAllTotalPages(result.totalPages);
      } catch (err) {
        if (!cancelled) {
          setViewAllItems([]);
          setViewAllError(err.message || "Could not load history.");
        }
      } finally {
        if (!cancelled) setViewAllLoading(false);
      }
    }, studentQ ? 320 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [viewAllOpen, viewAllPage, feedFilters, studentQ]);

  const clearFilters = () => {
    setLevel("");
    setCourseCode("");
    setStudentQ("");
    setFrom("");
    setTo("");
    setFilterId("all");
    setViewAllPage(1);
    setPage(1);
  };

  const openActiveToday = async () => {
    setActiveTodayOpen(true);
    setActiveTodayLoading(true);
    setActiveTodayError("");
    try {
      const students = await fetchActiveStudentsToday();
      setActiveTodayStudents(students);
    } catch (err) {
      setActiveTodayStudents([]);
      setActiveTodayError(err.message || "Could not load active students.");
    } finally {
      setActiveTodayLoading(false);
    }
  };

  const summaryCards = [
    {
      key: "registered",
      label: "Registered Students",
      value: overview?.totalRegisteredStudents,
      onClick: () => navigate("/admin/students"),
    },
    {
      key: "active",
      label: "Active Today",
      value: overview?.studentsActiveToday,
      onClick: openActiveToday,
    },
    {
      key: "ai",
      label: "AI Questions Today",
      value: overview?.aiAssistantQuestionsToday,
      onClick: () => setFilterId("ai"),
    },
    {
      key: "uploads",
      label: "Student Uploads",
      value: overview?.studentPersonalUploadsTotal,
      onClick: () => setFilterId("uploads"),
    },
  ];

  return (
    <section className="admin-act-page">
      <header className="admin-page-header admin-act-header">
        <div>
          <h1>Student Activity</h1>
          <p>
            Monitor registrations, logins, learning materials, AI usage, and
            personal uploads across AgriLearn.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-outline admin-act-viewall-btn"
          onClick={() => {
            setViewAllPage(1);
            setViewAllOpen(true);
          }}
        >
          View All
        </button>
      </header>

      {overviewError ? <p className="admin-form-error">{overviewError}</p> : null}

      <div className="admin-act-summary-grid">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className="admin-act-summary-card"
            onClick={card.onClick}
          >
            <span>{card.label}</span>
            <strong>
              {overviewLoading && card.value == null ? "…" : card.value ?? 0}
            </strong>
            <span className="admin-act-card-hint">Click for details</span>
          </button>
        ))}
      </div>

      <div className="admin-panel admin-act-panel">
        <div className="admin-act-filter-pills" role="tablist" aria-label="Activity type">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filterId === tab.id}
              className={filterId === tab.id ? "active" : ""}
              onClick={() => setFilterId(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-act-advanced-grid">
          <div className="admin-field">
            <label htmlFor="act-student-q">Search student</label>
            <input
              id="act-student-q"
              type="search"
              className="agri-search"
              placeholder="Name or email…"
              value={studentQ}
              onChange={(e) => setStudentQ(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="act-level">Level</label>
            <select
              id="act-level"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setCourseCode("");
              }}
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
            <label htmlFor="act-course">Course</label>
            <select
              id="act-course"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
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
            <label htmlFor="act-from">From</label>
            <input
              id="act-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="act-to">To</label>
            <input
              id="act-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-act-toolbar-actions">
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        {featureStatus ? (
          <p className="admin-muted admin-act-feature-status">{featureStatus}</p>
        ) : null}

        <div className="admin-act-recent-head">
          <h2>Recent Activity</h2>
        </div>

        {feedError ? <p className="admin-form-error">{feedError}</p> : null}
        {feedLoading ? <p className="admin-muted">Loading activity…</p> : null}

        {!feedLoading ? (
          <ActivityRecentList items={items} onSelect={setDetailItem} />
        ) : null}

        {!feedLoading && hasMore ? (
          <div className="admin-act-load-more">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>

      <ActivityDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      <ActivityViewAllModal
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        filterId={filterId}
        onFilterChange={setFilterId}
        level={level}
        onLevelChange={setLevel}
        courseCode={courseCode}
        onCourseCodeChange={setCourseCode}
        courseOptions={courseOptions}
        studentQ={studentQ}
        onStudentQChange={setStudentQ}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        onClearFilters={clearFilters}
        items={viewAllItems}
        loading={viewAllLoading}
        error={viewAllError}
        page={viewAllPage}
        totalPages={viewAllTotalPages}
        onPageChange={setViewAllPage}
        onSelectItem={(item) => {
          setDetailItem(item);
        }}
      />

      {activeTodayOpen ? (
        <div
          className="admin-act-modal-backdrop"
          role="presentation"
          onClick={() => setActiveTodayOpen(false)}
        >
          <div
            className="admin-act-modal admin-act-active-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-today-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="admin-act-modal-head">
              <div>
                <h2 id="active-today-title">Students active today</h2>
                <p className="admin-muted">
                  Based on last activity timestamp (UTC day).
                </p>
              </div>
              <button
                type="button"
                className="admin-act-icon-btn"
                onClick={() => setActiveTodayOpen(false)}
              >
                Close
              </button>
            </header>
            {activeTodayError ? (
              <p className="admin-form-error">{activeTodayError}</p>
            ) : null}
            {activeTodayLoading ? (
              <p className="admin-muted">Loading students…</p>
            ) : null}
            {!activeTodayLoading && !activeTodayStudents.length ? (
              <div className="admin-empty">
                <strong>No active students yet today</strong>
                Activity will appear after students sign in or use the platform.
              </div>
            ) : null}
            {!activeTodayLoading && activeTodayStudents.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Level</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTodayStudents.map((s) => (
                      <tr key={s.id || s._id || s.email}>
                        <td>{s.fullName}</td>
                        <td>{s.email}</td>
                        <td>{s.level} Level</td>
                        <td>
                          {s.lastActiveAt
                            ? new Date(s.lastActiveAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminActivity;
