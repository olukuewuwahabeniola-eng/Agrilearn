import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  clearAuthSession,
  getStoredStudent,
  getToken,
  setAuthSession,
} from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(() => getStoredStudent());
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    let cancelled = false;

    async function loadStudent() {
      const existingToken = getToken();
      if (!existingToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch("/api/auth/me");
        if (!cancelled) {
          setStudent(data.student);
          setToken(existingToken);
          setAuthSession(existingToken, data.student);
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setStudent(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStudent();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      student,
      token,
      isAuthenticated: Boolean(token && student),
      loading,
      loginSuccess(nextToken, nextStudent) {
        setAuthSession(nextToken, nextStudent);
        setToken(nextToken);
        setStudent(nextStudent);
      },
      logout() {
        clearAuthSession();
        setToken(null);
        setStudent(null);
      },
      updateStudent(nextStudent) {
        setStudent(nextStudent);
        if (nextStudent) {
          localStorage.setItem("agrilearn_student", JSON.stringify(nextStudent));
        }
      },
    }),
    [student, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
