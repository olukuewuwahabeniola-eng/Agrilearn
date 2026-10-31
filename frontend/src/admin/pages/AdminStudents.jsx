import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";
import { useAdminLevel } from "../AdminLevelContext";

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
    <section>
      <header className="admin-page-header">
        <h1>Manage Students</h1>
        <p>
          {isSuperAdmin
            ? "View registered AgriLearn student accounts (read-only)."
            : `View ${level || "assigned"} Level student accounts (read-only).`}
        </p>
      </header>

      <div className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="student-q">Search</label>
            <input
              id="student-q"
              type="search"
              placeholder="Name, email, or matric…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="admin-field" style={{ maxWidth: 160 }}>
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
                    {lvl}
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
        {loading ? <p className="admin-muted">Loading students…</p> : null}

        {!loading && !students.length ? (
          <div className="admin-empty">
            <strong>No students found</strong>
            Try a different search or level filter.
          </div>
        ) : null}

        {students.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Matric</th>
                  <th>Level</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id}>
                    <td>{s.fullName}</td>
                    <td>{s.email}</td>
                    <td>{s.matricNumber}</td>
                    <td>
                      <span className="admin-badge">{s.level}</span>
                    </td>
                    <td>
                      <Link
                        to={`/admin/students/${s._id}`}
                        className="admin-link-btn"
                        style={{ color: "#166534" }}
                      >
                        View
                      </Link>
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
