import { useState } from "react";
import { adminFetch } from "../../utils/adminApi";
import { useAdminAuth } from "../AdminAuthContext";

function AdminProfile() {
  const { admin, updateAdmin } = useAdminAuth();
  const [fullName, setFullName] = useState(admin?.fullName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");
    setSaving(true);
    try {
      const body = { fullName: fullName.trim() };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const data = await adminFetch("/api/admin/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      updateAdmin(data.admin);
      setStatus(data.message || "Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Admin Profile</h1>
        <p>Your administrator account details. Email cannot be changed here.</p>
      </header>

      <div className="admin-panel" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          {error ? <p className="admin-form-error">{error}</p> : null}
          {status ? <p className="admin-form-success">{status}</p> : null}

          <div className="admin-field" style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="admin-profile-email">Email</label>
            <input
              id="admin-profile-email"
              value={admin?.email || ""}
              disabled
              readOnly
            />
          </div>

          <div className="admin-field" style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="admin-profile-name">Full name</label>
            <input
              id="admin-profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="admin-field" style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="admin-profile-current">Current password</label>
            <input
              id="admin-profile-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Required only to change password"
            />
          </div>

          <div className="admin-field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="admin-profile-new">New password</label>
            <input
              id="admin-profile-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              placeholder="Leave blank to keep current password"
            />
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default AdminProfile;
