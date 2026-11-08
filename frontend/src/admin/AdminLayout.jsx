import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAdminAuth } from "./AdminAuthContext";
import { AdminLevelProvider, useAdminLevel } from "./AdminLevelContext";
import ErrorBoundary from "../components/ErrorBoundary";

const NAV = [
  { to: "/admin", end: true, label: "Overview" },
  { to: "/admin/students", label: "Manage Students" },
  { to: "/admin/community", label: "Community" },
  { to: "/admin/courses", label: "Manage Courses" },
  { to: "/admin/notes", label: "Upload Notes & Resources" },
  { to: "/admin/past-questions", label: "Manage Past Questions" },
  { to: "/admin/submissions", label: "Review Submissions" },
  { to: "/admin/materials", label: "Published Materials" },
  { to: "/admin/activity", label: "Student Activity" },
  {
    to: "/admin/administrators",
    label: "Manage Administrators",
    superOnly: true,
  },
  {
    to: "/admin/data-management",
    label: "Data Management",
    superOnly: true,
  },
  { to: "/admin/profile", label: "Admin Profile" },
];

function AdminLevelSwitcher() {
  const { isSuperAdmin, assignedLevel, selectedLevel, setSelectedLevel, levels } =
    useAdminLevel();

  if (!isSuperAdmin) {
    return (
      <div className="admin-level-chip" title="Your assigned academic level">
        {assignedLevel ? `${assignedLevel} Level` : "Level Admin"}
      </div>
    );
  }

  return (
    <label className="admin-level-switcher">
      <span>Level</span>
      <select
        value={selectedLevel || ""}
        onChange={(e) => setSelectedLevel(e.target.value)}
        aria-label="Filter by academic level"
      >
        <option value="">All levels</option>
        {levels.map((lvl) => (
          <option key={lvl} value={lvl}>
            {lvl} Level
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminLayoutInner() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSuper = Boolean(
    admin?.isSuperAdmin || admin?.role === "super_admin" || admin?.role === "admin"
  );

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  const navItems = NAV.filter((item) => !item.superOnly || isSuper);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const roleLabel = isSuper
    ? "Super Admin"
    : admin?.assignedLevel
      ? `${admin.assignedLevel} Level Admin`
      : "Level Admin";

  return (
    <div className={`admin-shell${menuOpen ? " menu-open" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <img src="/logo.png" alt="" className="admin-brand-logo" />
          </span>
          <div>
            <strong>AgriLearn</strong>
            <span>Admin Console</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <p>{admin?.fullName || "Administrator"}</p>
          <p className="admin-role-label">{roleLabel}</p>
          <button type="button" className="admin-link-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div
        className={`admin-overlay${menuOpen ? " show" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            Menu
          </button>
          <div className="admin-topbar-meta">
            <strong>{admin?.fullName || "Admin"}</strong>
            <span>
              {admin?.email} · {roleLabel}
            </span>
          </div>
          <AdminLevelSwitcher />
        </header>
        <main className="admin-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function AdminLayout() {
  return (
    <AdminLevelProvider>
      <AdminLayoutInner />
    </AdminLevelProvider>
  );
}

export default AdminLayout;
