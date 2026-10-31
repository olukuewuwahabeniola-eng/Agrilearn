import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "./data/courses";
import { useDashboardBase } from "./hooks/useDashboardBase";

function DashboardTopbar({ onMenuToggle }) {
  const { student, logout } = useAuth();
  const navigate = useNavigate();
  const base = useDashboardBase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef(null);

  const unreadCount = 0; // No notifications API yet

  useEffect(() => {
    function onDocClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
          placeholder="Search courses, notes, or topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search courses, notes, or topics"
        />
      </form>

      <div className="dash-top-actions">
        <button type="button" className="dash-bell" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9a6 6 0 0112 0c0 7 2 7 2 9H4c0-2 2-2 2-9z" />
            <path d="M10 20a2 2 0 004 0" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 && <span className="dash-bell-badge" />}
        </button>

        <div className="dash-profile-menu" ref={menuRef}>
          <button
            type="button"
            className="dash-profile-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="dash-avatar">{getInitials(student?.fullName)}</span>
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
