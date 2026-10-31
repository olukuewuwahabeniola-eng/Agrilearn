import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";
import { useAdminLevel } from "../AdminLevelContext";

function AdminOverview() {
  const { isSuperAdmin, selectedLevel, assignedLevel } = useAdminLevel();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedLevel) params.set("level", selectedLevel);
        const query = params.toString();
        const res = await adminFetch(
          `/api/admin/overview${query ? `?${query}` : ""}`
        );
        if (!cancelled) setData(res.overview);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLevel]);

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : `${assignedLevel || ""} Level Admin`;

  return (
    <section>
      <header className="admin-page-header">
        <h1>Dashboard overview</h1>
        <p>
          Platform snapshot for AgriLearn administrators
          {selectedLevel ? ` · ${selectedLevel} Level` : ""}. You are signed in
          as {roleLabel}.
        </p>
      </header>

      {loading ? <p className="admin-muted">Loading overview…</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {data ? (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <span>Students</span>
              <strong>{data.studentsCount}</strong>
            </div>
            <div className="admin-stat">
              <span>Notes & PDFs</span>
              <strong>{data.notesCount}</strong>
            </div>
            <div className="admin-stat">
              <span>AI conversations</span>
              <strong>{data.conversationsCount}</strong>
            </div>
            {isSuperAdmin ? (
              <div className="admin-stat">
                <span>Admins</span>
                <strong>{data.adminsCount}</strong>
              </div>
            ) : (
              <div className="admin-stat">
                <span>Your level</span>
                <strong>{assignedLevel || "—"}</strong>
              </div>
            )}
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <h2>Students by level</h2>
              <div className="admin-stats" style={{ marginBottom: 0 }}>
                {(isSuperAdmin
                  ? ["100", "200", "300", "500"]
                  : [assignedLevel || selectedLevel].filter(Boolean)
                ).map((lvl) => (
                  <div className="admin-stat" key={lvl}>
                    <span>{lvl} Level</span>
                    <strong>{data.levelCounts?.[lvl] || 0}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-panel">
              <h2>Quick links</h2>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                <Link className="admin-btn admin-btn-outline" to="/admin/students">
                  Manage Students
                </Link>
                <Link className="admin-btn admin-btn-outline" to="/admin/notes">
                  Upload Notes
                </Link>
                <Link className="admin-btn admin-btn-outline" to="/admin/activity">
                  Student Activity
                </Link>
                {isSuperAdmin ? (
                  <Link
                    className="admin-btn admin-btn-outline"
                    to="/admin/administrators"
                  >
                    Manage Administrators
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <h2>Recent students</h2>
              {data.recentStudents?.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Level</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentStudents.map((s) => (
                        <tr key={s._id}>
                          <td>
                            <Link to={`/admin/students/${s._id}`}>
                              {s.fullName}
                            </Link>
                          </td>
                          <td>
                            <span className="admin-badge">{s.level}</span>
                          </td>
                          <td>{s.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-muted">No students yet.</p>
              )}
            </div>

            <div className="admin-panel">
              <h2>Recent notes</h2>
              {data.recentNotes?.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Course</th>
                        <th>Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentNotes.map((n) => (
                        <tr key={n._id || n.id}>
                          <td>{n.title}</td>
                          <td>{n.courseCode}</td>
                          <td>
                            <span className="admin-badge">{n.level}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-muted">No notes yet.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default AdminOverview;
