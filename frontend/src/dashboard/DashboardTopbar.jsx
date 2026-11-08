import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  formatUploadDate,
  getDashboardOverview,
} from "../utils/dashboardApi";
import { getInitials } from "./data/courses";
import CommunityAvatar from "./components/community/CommunityAvatar";
import { useDashboardBase } from "./hooks/useDashboardBase";

function studentKey(student) {
  return String(student?._id || student?.id || "");
}

function notificationItemKey(item) {
  return `${item.kind}-${item.id}`;
}

function readStorageKey(id) {
  return `agrilearn.notifications.read:${id}`;
}

function loadReadIds(id) {
  if (!id) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(readStorageKey(id)) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveReadIds(id, keys) {
  if (!id) return;
  localStorage.setItem(readStorageKey(id), JSON.stringify([...new Set(keys)]));
}

function DashboardTopbar({ onMenuToggle }) {
  const { student, logout } = useAuth();
  const navigate = useNavigate();
  const base = useDashboardBase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const studentId = studentKey(student);

  useEffect(() => {
    function onDocClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setReadIds(loadReadIds(studentId));
    if (!studentId) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;
    getDashboardOverview()
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data.recentUploads) ? data.recentUploads : [];
        setNotifications(
          items.map((item) => ({
            ...item,
            key: notificationItemKey(item),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const unreadCount = notifications.filter(
    (item) => !readIds.includes(item.key)
  ).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`${base}/courses?q=${encodeURIComponent(q)}`);
  };

  const openNotifications = () => {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    setMenuOpen(false);
    if (nextOpen && notifications.length > 0) {
      const nextRead = [
        ...readIds,
        ...notifications.map((item) => item.key),
      ];
      setReadIds(nextRead);
      saveReadIds(studentId, nextRead);
    }
  };

  const notificationPath = (item) =>
    item.kind === "past_question" ? `${base}/past-questions` : `${base}/notes`;

  return (
    <header className="dash-topbar">
      <button
        type="button"
        className="dash-menu-btn"
        aria-label="Open menu"
        onClick={onMenuToggle}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <form className="dash-search" onSubmit={handleSearch}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className="agri-search"
          placeholder="Search courses, notes, or topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search courses, notes, or topics"
        />
      </form>

      <div className="dash-top-actions">
        <div className="dash-notif-wrap" ref={notifRef}>
          <button
            type="button"
            className="dash-bell"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            aria-expanded={notifOpen}
            onClick={openNotifications}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9a6 6 0 0112 0c0 7 2 7 2 9H4c0-2 2-2 2-9z" />
              <path d="M10 20a2 2 0 004 0" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 && <span className="dash-bell-badge" />}
          </button>

          <div className={`dash-notif-dropdown ${notifOpen ? "open" : ""}`}>
            <div className="dash-notif-head">
              <strong>Notifications</strong>
              <span>
                {notifications.length === 0
                  ? "None"
                  : `${notifications.length} recent`}
              </span>
            </div>
            {notifications.length === 0 ? (
              <p className="dash-notif-empty">
                No new materials have been published for your level yet.
              </p>
            ) : (
              <ul className="dash-notif-list">
                {notifications.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={notificationPath(item)}
                      onClick={() => setNotifOpen(false)}
                    >
                      <strong>{item.title}</strong>
                      <span className="dash-notif-meta">
                        <span>
                          {item.kind === "past_question"
                            ? "Past question"
                            : "Lecture notes"}
                          {item.courseCode ? ` · ${item.courseCode}` : ""}
                        </span>
                        {item.createdAt ? (
                          <time dateTime={item.createdAt}>
                            {formatUploadDate(item.createdAt)}
                          </time>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dash-profile-menu" ref={menuRef}>
          <button
            type="button"
            className="dash-profile-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {student?.hasAvatar || student?.avatar?.hasAvatar ? (
              <CommunityAvatar
                studentId={studentKey(student)}
                name={student?.fullName}
                hasAvatar
                className="dash-avatar"
              />
            ) : (
              <span className="dash-avatar">{getInitials(student?.fullName)}</span>
            )}
            <span className="dash-profile-text">
              <strong>{student?.fullName || "Student"}</strong>
              <span>
                {student?.level ? `${student.level} Level` : "Student"}
                {student?.department ? ` • ${student.department}` : ""}
              </span>
            </span>
            <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>

          <div className={`dash-dropdown ${menuOpen ? "open" : ""}`}>
            <Link to={`${base}/profile`} onClick={() => setMenuOpen(false)}>
              Profile settings
            </Link>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardTopbar;
