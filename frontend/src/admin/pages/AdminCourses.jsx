import { useEffect, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

function AdminCourses() {
  const [level, setLevel] = useState("100");
  const [byLevel, setByLevel] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch("/api/admin/courses");
        if (!cancelled) setByLevel(data.byLevel || {});
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load courses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const courses = byLevel?.[level] || [];

  return (
    <section>
      <header className="admin-page-header">
        <h1>Manage Courses</h1>
        <p>
          Read-only course catalogs aligned with student dashboards. Courses are
          not invented here.
        </p>
      </header>

      <div className="admin-panel">
        <div className="admin-level-chips">
          {["100", "200", "300", "500"].map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={level === lvl ? "active" : ""}
              onClick={() => setLevel(lvl)}
            >
              {lvl} Level
            </button>
          ))}
        </div>

        {loading ? <p className="admin-muted">Loading courses…</p> : null}
        {error ? <p className="admin-form-error">{error}</p> : null}

        {!loading && !error ? (
          <>
            <p className="admin-muted" style={{ marginBottom: "0.75rem" }}>
              {courses.length} course{courses.length === 1 ? "" : "s"} for{" "}
              {level} Level
            </p>
            <ul className="admin-course-list">
              {courses.map((c) => (
                <li key={c.code}>
                  <strong>{c.code}</strong>
                  <span>{c.title}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default AdminCourses;
