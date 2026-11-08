import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";
import AdminPageHeader from "../components/AdminPageHeader";
import { useAdminLevel } from "../AdminLevelContext";

function formatJoined(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function AdminStudents() {
  const { isSuperAdmin, selectedLevel, setSelectedLevel, levels } =
    useAdminLevel();
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const level = selectedLevel || "";

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (level) params.set("level", level);
        const query = params.toString();
        const data = await adminFetch(
          `/api/admin/students${query ? `?${query}` : ""}`
        );
        setStudents(Array.isArray(data.students) ? data.students : []);
      } catch (err) {
        setStudents([]);
        setError(err.message || "Could not load students.");
      } finally {
        setLoading(false);
      }
    }, q ? 280 : 0);
    return () => clearTimeout(timer);
  }, [q, level]);

  return (
    <section className="admin-mgmt">
      <AdminPageHeader title="Manage Students">
        {isSuperAdmin
          ? "Review registered AgriLearn student accounts. Search by name, email or matric number, then open a record for full details."
          : `Review ${level || "assigned"} Level student accounts. Search by name, email or matric number, then open a record for full details.`}
      </AdminPageHeader>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Student directory</h2>
            <p className="admin-panel-lede">
              {isSuperAdmin
                ? "Super Admin can browse every academic level. Passwords are never shown."
                : "Level Admin access is limited to your assigned academic level. Passwords are never shown."}
            </p>
          </div>
          <span className="admin-count">
            {loading ? "Loading…" : `${students.length} student${students.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="student-q">Search</label>
            <input
              id="student-q"
              type="search"
              className="agri-search"
              placeholder="Name, email, or matric…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="admin-field admin-field-sm">
            <label htmlFor="student-level">Level</label>
            {isSuperAdmin ? (
              <select
                id="student-level"
                value={level}
                onChange={(e) => setSelectedLevel(e.target.value)}
              >
                <option value="">All levels</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="student-level"
                value={`${level} Level`}
                disabled
                readOnly
              />
            )}
          </div>
        </div>

        {error ? <p className="admin-form-error">{error}</p> : null}
        {loading ? <p className="admin-loading">Loading students…</p> : null}

        {!loading && !students.length ? (
          <div className="admin-empty">
            <div className="admin-empty-icon" aria-hidden="true" />
            <strong>No students found</strong>
            Try a different search or level filter.
          </div>
        ) : null}

        {students.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Matric</th>
                  <th>Level</th>
                  <th>Registered</th>
                  <th className="admin-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="admin-cell-primary">{s.fullName}</div>
                      <div className="admin-cell-sub">{s.email}</div>
                    </td>
                    <td>{s.matricNumber || "—"}</td>
                    <td>
                      <span className="admin-badge">{s.level}</span>
                    </td>
                    <td>{formatJoined(s.createdAt)}</td>
                    <td className="admin-col-actions">
                      <div className="admin-file-actions">
                        <Link
                          to={`/admin/students/${s._id}`}
                          className="admin-btn admin-btn-ghost admin-btn-compact"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default AdminStudents;
