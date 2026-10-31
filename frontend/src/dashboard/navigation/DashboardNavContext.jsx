import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

const DashboardNavContext = createContext(null);

function locationKey(location) {
  return `${location.pathname}${location.search}`;
}

/**
 * Tracks in-app dashboard navigation so Back can use history (-1)
 * when available, or fall back to the current level dashboard home.
 */
export function DashboardNavProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const stackRef = useRef([locationKey(location)]);
  const skippingPushRef = useRef(false);

  useEffect(() => {
    const key = locationKey(location);

    if (skippingPushRef.current) {
      skippingPushRef.current = false;
      return;
    }

    if (navigationType === "POP") {
      const idx = stackRef.current.lastIndexOf(key);
      if (idx >= 0) {
        stackRef.current = stackRef.current.slice(0, idx + 1);
      } else {
        stackRef.current = [key];
      }
      return;
    }

    if (navigationType === "REPLACE") {
      const next = [...stackRef.current];
      if (next.length === 0) next.push(key);
      else next[next.length - 1] = key;
      stackRef.current = next;
      return;
    }

    // PUSH
    const current = stackRef.current[stackRef.current.length - 1];
    if (current !== key) {
      stackRef.current = [...stackRef.current, key];
    }
  }, [location, navigationType]);

  const value = useMemo(
    () => ({
      canGoBack: () => stackRef.current.length > 1,
      goBack(fallback) {
        if (stackRef.current.length > 1) {
          skippingPushRef.current = true;
          stackRef.current = stackRef.current.slice(0, -1);
          navigate(-1);
          return;
        }
        navigate(fallback || "/dashboard", { replace: true });
      },
    }),
    [navigate]
  );

  return (
    <DashboardNavContext.Provider value={value}>
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNav() {
  const context = useContext(DashboardNavContext);
  if (!context) {
    throw new Error("useDashboardNav must be used within DashboardNavProvider");
  }
  return context;
}
