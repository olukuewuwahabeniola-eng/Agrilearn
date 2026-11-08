import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardOverview } from "../utils/dashboardApi";
import { getInitials } from "./data/courses";
import CommunityAvatar from "./components/community/CommunityAvatar";
import { getDashboardCourses } from "./data/dashboardCourses";
import { getDashboardBasePath, normalizeLevel } from "./levelPaths";
import { DashboardNavProvider } from "./navigation/DashboardNavContext";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopbar from "./DashboardTopbar";
import ErrorBoundary from "../components/ErrorBoundary";
import "./dashboard.css";
import "./components/community/community.css";

function DashboardShell() {
  const { student } = useAuth();
  const location = useLocation();
  const { level } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState({
    notesAvailable: 0,
    quizzesCompleted: 0,
    recentActivity: [],
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  const activeLevel = normalizeLevel(level) || normalizeLevel(student?.level);
  const base = getDashboardBasePath(activeLevel);
  const courseCount = getDashboardCourses(activeLevel).length;
  const showRightRail =
    location.pathname === base || location.pathname === `${base}/`;

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showRightRail || !student) return undefined;
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const data = await getDashboardOverview();
        if (cancelled) return;
        setSummary({
          notesAvailable: data.stats?.notesAvailable ?? 0,
          quizzesCompleted: data.stats?.quizzesCompleted ?? 0,
          recentActivity: Array.isArray(data.recentActivity)
            ? data.recentActivity
            : [],
        });
      } catch {
        if (!cancelled) {
          setSummary({
            notesAvailable: 0,
            quizzesCompleted: 0,
            recentActivity: [],
          });
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRightRail, student?.id, student?._id, location.pathname]);

  return (
    <div className={`dashboard-shell ${showRightRail ? "right-open" : ""}`}>
      <div
        className={`overlay ${sidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <DashboardSidebar open={sidebarOpen} onNavigate={closeSidebar} />

      <div className="dash-main">
        <DashboardTopbar onMenuToggle={() => setSidebarOpen((open) => !open)} />

        <div className="dash-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>

        <footer className="dash-footer">
          <span>AgriLearn • Learn • Grow • Build Your Future</span>
          <span>Together for a Greener Tomorrow</span>
        </footer>
      </div>

      {showRightRail && (
        <aside className="dash-right" aria-label="Student summary">
          <div className="dash-panel profile-summary">
            {student?.hasAvatar || student?.avatar?.hasAvatar ? (
              <CommunityAvatar
                studentId={String(student?._id || student?.id || "")}
                name={student?.fullName}
                hasAvatar
                className="big-avatar lg"
              />
            ) : (
              <div className="big-avatar">{getInitials(student?.fullName)}</div>
            )}
            <strong>{student?.fullName || "Student"}</strong>
            <p className="meta">
              {student?.level ? `${student.level} Level` : "Student"}
              {student?.department ? ` • ${student.department}` : ""}
            </p>
            <div className="profile-stats">
              <div>
                <span>Courses enrolled</span>
                <strong>{courseCount}</strong>
              </div>
              <div>
                <span>Notes available</span>
                <strong>
                  {summaryLoading ? "…" : summary.notesAvailable}
                </strong>
              </div>
              <div>
                <span>Quizzes completed</span>
                <strong>
                  {summaryLoading ? "…" : summary.quizzesCompleted}
                </strong>
              </div>
            </div>
          </div>

          <div className="dash-panel">
            <h3>Latest Activity</h3>
            {summaryLoading ? (
              <div className="empty-state">
                <strong>Loading activity…</strong>
              </div>
            ) : summary.recentActivity.length === 0 ? (
              <div className="empty-state">
                <strong>No activity yet</strong>
                Your recent learning activity will appear here once you start
                using courses, notes, and quizzes.
              </div>
            ) : (
              <div className="activity-list">
                {summary.recentActivity.slice(0, 8).map((item) => (
                  <div className="activity-item" key={item.id}>
                    <span className="activity-dot" aria-hidden="true" />
                    <div>
                      <strong>{item.description}</strong>
                      <span className="activity-time">
                        {item.relativeTime || ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="help-card">
            <div
              className="dash-motivate-icon"
              aria-hidden="true"
              style={{
                background: "#dcfce7",
                color: "#166534",
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                borderRadius: 10,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 3c2.5 4 2.5 7 0 11-2.5-4-2.5-7 0-11z" />
                <path d="M12 12v9" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Need Help?</h3>
            <p>Questions about AgriLearn? Reach out and we will support you.</p>
            <Link to={`${base}/support`} className="btn btn-primary">
              Contact Us
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}

function DashboardLayout() {
  return (
    <DashboardNavProvider>
      <DashboardShell />
    </DashboardNavProvider>
  );
}

export default DashboardLayout;
