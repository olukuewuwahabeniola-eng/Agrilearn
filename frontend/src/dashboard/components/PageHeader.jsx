import { useDashboardBase } from "../hooks/useDashboardBase";
import BackButton from "./BackButton";

function PageHeader({ title, subtitle, showBack = true, fallback }) {
  const base = useDashboardBase();
  const resolvedFallback = fallback || base;

  return (
    <header className="dash-page-header">
      {showBack && <BackButton fallback={resolvedFallback} />}
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}

export default PageHeader;
