import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminMaterials() {
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          `/api/admin/notes${query ? `?${query}` : ""}`
        );
        setNotes(Array.isArray(data.notes) ? data.notes : []);
      } catch (err) {
        setNotes([]);
        setError(err.message || "Could not load materials.");
      } finally {
        setLoading(false);
      }
    }, q ? 280 : 0);
    return () => clearTimeout(timer);
  }, [q, level]);

  return (
    <section>
      <header className="admin-page-header">
        <h1>Manage Published Materials</h1>
        <p>
          Published lecture PDFs available to students by academic level.{" "}
          <Link to="/admin/notes" style={{ color: "#166534", fontWeight: 700 }}>
            Upload more
          </Link>
        </p>
      </header>

      <div className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="mat-q">Search</label>
            <input
              id="mat-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, file, course…"
            />
          </div>
          <div className="admin-field" style={{ maxWidth: 160 }}>
            <label htmlFor="mat-level">Level</label>
            <select
              id="mat-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">All</option>
              {["100", "200", "300", "500"].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="admin-form-error">{error}</p> : null}
        {loading ? <p className="admin-muted">Loading materials…</p> : null}

        {!loading && !notes.length ? (
          <div className="admin-empty">
            <strong>No published materials</strong>
            Upload notes from Upload Notes & Resources.
          </div>
        ) : null}

        {notes.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Course</th>
                  <th>Level</th>
                  <th>Size</th>
                  <th>Published</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td>{n.title}</td>
                    <td>{n.description || "—"}</td>
                    <td>
                      {n.courseCode}
                      <div className="admin-muted">{n.courseTitle}</div>
                    </td>
                    <td>
                      <span className="admin-badge">{n.level}</span>
                    </td>
                    <td>{formatBytes(n.size)}</td>
                    <td>
                      {n.createdAt
                        ? new Date(n.createdAt).toLocaleDateString()
                        : "—"}
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

export default AdminMaterials;
