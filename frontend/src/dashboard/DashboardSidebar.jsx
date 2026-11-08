import { NavLink, useParams } from "react-router-dom";
import { getDashboardBasePath, normalizeLevel } from "./levelPaths";

function buildNav(base) {
  return [
    { to: base, label: "Dashboard", end: true, icon: "home" },
    { to: `${base}/courses`, label: "My Courses", icon: "courses" },
    { to: `${base}/notes`, label: "Notes & Resources", icon: "notes" },
    { to: `${base}/community`, label: "Community", icon: "community" },
    { to: `${base}/past-questions`, label: "Past Questions", icon: "past" },
    { to: `${base}/quizzes`, label: "Quizzes", icon: "quiz" },
    { to: `${base}/ai-assistant`, label: "AI Assistant", icon: "ai" },
    { to: `${base}/progress`, label: "My Progress", icon: "progress" },
    { to: `${base}/profile`, label: "Profile", icon: "profile" },
  ];
}

function NavIcon({ type }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
  };

  switch (type) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
        </svg>
      );
    case "courses":
      return (
        <svg {...common}>
          <path d="M4 5h7v14H4zM13 5h7v14h-7z" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <path d="M7 3h8l4 4v14H7V3z" />
          <path d="M15 3v4h4M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      );
    case "community":
      return (
        <svg {...common}>
          <path d="M4 6h12v8H8l-4 3V6z" />
          <path d="M10 10h8v8h-5l-3 2v-10z" />
        </svg>
      );
    case "past":
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z" />
        </svg>
      );
    case "quiz":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.5 10a2.5 2.5 0 114 2c-.7.6-1.5 1-1.5 2M12 17h.01" strokeLinecap="round" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
        </svg>
      );
    case "progress":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" strokeLinecap="round" />
          <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.8-3.2 4.2-4.5 7-4.5S17.2 15.8 19 19" strokeLinecap="round" />
        </svg>
      );
  }
}

function DashboardSidebar({ open, onNavigate }) {
  const { level } = useParams();
  const base = getDashboardBasePath(normalizeLevel(level));
  const nav = buildNav(base);

  return (
    <aside className={`dash-sidebar ${open ? "open" : ""}`} aria-label="Student navigation">
      <NavLink to={base} className="dash-brand" onClick={onNavigate} end>
        <span className="dash-brand-icon" aria-hidden="true">
          <img src="/logo.png" alt="" className="dash-brand-logo" />
        </span>
        <span>
          <strong>AgriLearn</strong>
          <span>Learn • Grow • Build Your Future</span>
        </span>
      </NavLink>

      <nav className="dash-nav">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
            onClick={onNavigate}
          >
            <NavIcon type={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="dash-motivate">
        <div className="dash-motivate-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#86EFAC" strokeWidth="1.8">
            <path d="M12 3c2.5 4 2.5 7 0 11-2.5-4-2.5-7 0-11z" />
            <path d="M12 12v9" strokeLinecap="round" />
          </svg>
        </div>
        <p>Small steps today, big harvests tomorrow.</p>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
