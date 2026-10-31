import { useDashboardBase } from "../hooks/useDashboardBase";
import { useDashboardNav } from "../navigation/DashboardNavContext";

function BackButton({ fallback, label = "Go back" }) {
  const base = useDashboardBase();
  const { goBack } = useDashboardNav();
  const resolvedFallback = fallback || base;

  return (
    <button
      type="button"
      className="dash-back-btn"
      onClick={() => goBack(resolvedFallback)}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Back</span>
    </button>
  );
}

export default BackButton;
