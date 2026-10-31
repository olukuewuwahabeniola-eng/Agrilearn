import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";

function AdminStudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch(`/api/admin/students/${id}`);
        if (!cancelled) {
          setStudent(data.student);
          setStats(data.stats);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Student not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <section>
      <header className="admin-page-header">
        <p className="admin-muted" style={{ marginBottom: "0.35rem" }}>
          <Link to="/admin/students" style={{ color: "#166534", fontWeight: 700 }}>
            ← Manage Students
          </Link>
        </p>
        <h1>Student detail</h1>
        <p>Account information for administrators (passwords are never shown).</p>
      </header>

      {loading ? <p className="admin-muted">Loading…</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {student ? (
        <div className="admin-panel">
          <h2>{student.fullName}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                <tr>
                  <th>Email</th>
                  <td>{student.email}</td>
                </tr>
                <tr>
                  <th>Matric number</th>
                  <td>{student.matricNumber}</td>
                </tr>
                <tr>
                  <th>Level</th>
                  <td>
                    <span className="admin-badge">{student.level}</span>
                  </td>
                </tr>
                <tr>
                  <th>Joined</th>
                  <td>
                    {student.createdAt
                      ? new Date(student.createdAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <th>Notes uploaded</th>
                  <td>{stats?.notesCount ?? 0}</td>
                </tr>
                <tr>
                  <th>AI conversations</th>
                  <td>{stats?.conversationsCount ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminStudentDetail;
