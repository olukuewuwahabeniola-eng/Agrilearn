import { useAuth } from "../../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { getInitials } from "../data/courses";

function Profile() {
  const { student } = useAuth();

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="Profile"
        subtitle="Your AgriLearn student account details."
      />

      <div
        className="dash-panel profile-summary"
        style={{ marginTop: "1rem", maxWidth: 420 }}
      >
        <div className="big-avatar">{getInitials(student?.fullName)}</div>
        <strong>{student?.fullName || "Student"}</strong>
        <p className="meta">
          {student?.level ? `${student.level} Level` : "Student"}
        </p>
        <div className="profile-stats">
          <div>
            <span>Email</span>
            <strong style={{ fontWeight: 600 }}>{student?.email || "—"}</strong>
          </div>
          <div>
            <span>Matric number</span>
            <strong style={{ fontWeight: 600 }}>
              {student?.matricNumber || "—"}
            </strong>
          </div>
          <div>
            <span>Academic level</span>
            <strong style={{ fontWeight: 600 }}>
              {student?.level ? `${student.level} Level` : "—"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Profile;
