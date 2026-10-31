import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAdminAuth } from "./AdminAuthContext";

const LEVELS = ["100", "200", "300", "500"];
const STORAGE_KEY = "agrilearn_admin_level_filter";

const AdminLevelContext = createContext(null);

export function AdminLevelProvider({ children }) {
  const { admin } = useAdminAuth();
  const isSuper = Boolean(admin?.isSuperAdmin || admin?.role === "super_admin");
  const assignedLevel = admin?.assignedLevel || null;

  const [selectedLevel, setSelectedLevelState] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!isSuper && assignedLevel) {
      setSelectedLevelState(assignedLevel);
    }
  }, [isSuper, assignedLevel]);

  const setSelectedLevel = (next) => {
    const value = String(next || "").trim();
    if (value && !LEVELS.includes(value)) return;
    if (!isSuper && assignedLevel && value && value !== assignedLevel) return;
    setSelectedLevelState(value);
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, value);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const effectiveLevel = isSuper
    ? selectedLevel || ""
    : assignedLevel || "";

  const value = useMemo(
    () => ({
      levels: LEVELS,
      isSuperAdmin: isSuper,
      assignedLevel,
      selectedLevel: effectiveLevel,
      setSelectedLevel,
      /** Query param helper — empty string means all levels (super only). */
      levelQueryParam: effectiveLevel || null,
    }),
    [isSuper, assignedLevel, effectiveLevel]
  );

  return (
    <AdminLevelContext.Provider value={value}>
      {children}
    </AdminLevelContext.Provider>
  );
}

export function useAdminLevel() {
  const ctx = useContext(AdminLevelContext);
  if (!ctx) {
    throw new Error("useAdminLevel must be used inside AdminLevelProvider");
  }
  return ctx;
}

export { LEVELS as ADMIN_LEVELS };
