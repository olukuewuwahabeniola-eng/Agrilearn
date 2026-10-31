import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  adminFetch,
  clearAdminSession,
  getAdminToken,
  getStoredAdmin,
  hasAdminSessionHint,
  setAdminSession,
} from "../utils/adminApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => getStoredAdmin());
  const [token, setToken] = useState(() => getAdminToken());
  const [loading, setLoading] = useState(true);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const restoreAdminSession = useCallback(async () => {
    setLoading(true);
    setRestoreError("");
    try {
      const data = await adminFetch("/api/admin/auth/me");
      const existingToken = getAdminToken();
      setAdmin(data.admin);
      if (existingToken) setToken(existingToken);
      setAdminSession(existingToken || undefined, data.admin);
      setSessionVerified(true);
    } catch (error) {
      const status = error?.status;
      if (status === 401 || status === 403) {
        clearAdminSession();
        setAdmin(null);
        setToken(null);
        setSessionVerified(false);
        setRestoreError("");
      } else {
        // Network / DB issues — do not clear cookie or treat as logout.
        setSessionVerified(false);
        setRestoreError(
          error?.message ||
            "Could not verify your admin session. Check that the backend is running."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreAdminSession();
  }, [restoreAdminSession]);

  const value = useMemo(
    () => ({
      admin,
      token,
      // Only true after backend /me confirms this user is an administrator.
      isAuthenticated: Boolean(sessionVerified && admin),
      loading,
      restoreError,
      hasSessionHint: hasAdminSessionHint() || Boolean(admin),
      retrySession: restoreAdminSession,
      loginSuccess(nextToken, nextAdmin) {
        setAdminSession(nextToken, nextAdmin);
        setToken(nextToken);
        setAdmin(nextAdmin);
        setSessionVerified(true);
        setRestoreError("");
        setLoading(false);
      },
      async logout() {
        try {
          await adminFetch("/api/admin/auth/logout", { method: "POST" });
        } catch {
          /* still clear local session */
        }
        clearAdminSession();
        setToken(null);
        setAdmin(null);
        setSessionVerified(false);
        setRestoreError("");
        setLoading(false);
      },
      updateAdmin(nextAdmin) {
        setAdmin(nextAdmin);
        if (nextAdmin) {
          localStorage.setItem("agrilearn_admin", JSON.stringify(nextAdmin));
        }
      },
    }),
    [admin, token, loading, sessionVerified, restoreError, restoreAdminSession]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return context;
}
