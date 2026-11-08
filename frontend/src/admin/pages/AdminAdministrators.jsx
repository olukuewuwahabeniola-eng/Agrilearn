import { useCallback, useEffect, useState } from "react";
import {
  createAdministrator,
  deleteAdministrator,
  listAdministrators,
  resetAdministratorAccess,
  updateAdministrator,
} from "../../utils/adminAdministratorsApi";
import { useAdminAuth } from "../AdminAuthContext";

const LEVELS = ["100", "200", "300", "500"];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function statusLabel(row) {
  if (row.isActive === false) return "Inactive";
  if (row.invitePending || row.accountStatus === "pending_invite") {
    return "Pending invite";
  }
  return "Active";
}

function AdminAdministrators() {
  const { admin: currentAdmin } = useAdminAuth();
  const [administrators, setAdministrators] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [assignedLevel, setAssignedLevel] = useState("100");
  const [setupMethod, setSetupMethod] = useState("invite");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [copyState, setCopyState] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdministrators({
        q: q.trim() || undefined,
        role: roleFilter || undefined,
        level: levelFilter || undefined,
      });
      setAdministrators(
        Array.isArray(data.administrators) ? data.administrators : []
      );
    } catch (err) {
      setAdministrators([]);
      setError(err.message || "Could not load administrators.");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, levelFilter]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 280 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const resetCreateForm = () => {
    setFullName("");
    setEmail("");
    setAssignedLevel("100");
    setPassword("");
    setConfirmPassword("");
    setSetupMethod("invite");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");
    setCreatedResult(null);
    setCopyState("");

    if (setupMethod === "manual_password") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setCreating(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setCreating(false);
        return;
      }
    }

    try {
      const body = {
        fullName: fullName.trim(),
        email: email.trim(),
        assignedLevel,
        setupMethod,
      };
      if (setupMethod === "manual_password") {
        body.password = password;
        body.confirmPassword = confirmPassword;
      }

      const data = await createAdministrator(body);
      setMessage(data.message || "Level administrator created.");
      setCreatedResult({
        setupMethod,
        email: data.credentials?.email || email.trim(),
        inviteUrl: data.credentials?.inviteUrl || null,
        inviteExpiresAt: data.credentials?.inviteExpiresAt || null,
        note: data.credentials?.note || "",
        assignedLevel,
      });
      resetCreateForm();
      await load();
    } catch (err) {
      setError(err.message || "Could not create administrator.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyInvite = async () => {
    const url = createdResult?.inviteUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState(""), 2000);
    } catch {
      setCopyState("failed");
    }
  };

  const handleToggleActive = async (row) => {
    if (row.isSuperAdmin || row.role === "super_admin") return;
    setBusyId(row._id);
    setError("");
    setMessage("");
    try {
      await updateAdministrator(row._id, { isActive: !row.isActive });
      setMessage(
        row.isActive ? "Administrator deactivated." : "Administrator activated."
      );
      await load();
    } catch (err) {
      setError(err.message || "Could not update status.");
    } finally {
      setBusyId("");
    }
  };

  const handleChangeLevel = async (row, nextLevel) => {
    if (row.isSuperAdmin || row.role === "super_admin") return;
    if (!LEVELS.includes(nextLevel)) return;
    setBusyId(row._id);
    setError("");
    setMessage("");
    try {
      await updateAdministrator(row._id, { assignedLevel: nextLevel });
      setMessage(`Assigned level updated to ${nextLevel}.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not update assigned level.");
    } finally {
      setBusyId("");
    }
  };

  const handleResendInvite = async (row) => {
    if (row.isSuperAdmin || row.role === "super_admin") return;
    setBusyId(row._id);
    setError("");
    setMessage("");
    setCreatedResult(null);
    setCopyState("");
    try {
      const data = await resetAdministratorAccess(row._id, {
        setupMethod: "invite",
      });
      setMessage(data.message || "New invitation link generated.");
      setCreatedResult({
        setupMethod: "invite",
        email: data.credentials?.email || row.email,
        inviteUrl: data.credentials?.inviteUrl || null,
        inviteExpiresAt: data.credentials?.inviteExpiresAt || null,
        note: data.credentials?.note || "",
        assignedLevel: row.assignedLevel,
      });
      await load();
    } catch (err) {
      setError(err.message || "Could not generate invitation.");
    } finally {
      setBusyId("");
    }
  };

  const handleRemove = async (row) => {
    if (row.isSuperAdmin || row.role === "super_admin") return;
    if (String(row._id) === String(currentAdmin?._id)) return;
    const ok = window.confirm(
      `Remove Level Admin ${row.fullName} (${row.email})? This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(row._id);
    setError("");
    setMessage("");
    try {
      await deleteAdministrator(row._id);
      setMessage("Administrator removed.");
      await load();
    } catch (err) {
      setError(err.message || "Could not remove administrator.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Manage Administrators</h1>
        <p>
          Create and manage Level Admins. Only Super Admins can access this
          section.
        </p>
      </header>

      <div className="admin-panel" style={{ marginBottom: "1.25rem" }}>
        <h2>Create Level Admin</h2>

        <div className="admin-setup-options" role="radiogroup" aria-label="Account setup method">
          <button
            type="button"
            className={`admin-setup-card${setupMethod === "invite" ? " selected" : ""}`}
            onClick={() => setSetupMethod("invite")}
            aria-pressed={setupMethod === "invite"}
            disabled={creating}
          >
            <strong>Generate Invitation Link</strong>
            <span>
              Create a secure link the administrator opens to set their own
              password. Expires in 48 hours.
            </span>
          </button>
          <button
            type="button"
            className={`admin-setup-card${
              setupMethod === "manual_password" ? " selected" : ""
            }`}
            onClick={() => setSetupMethod("manual_password")}
            aria-pressed={setupMethod === "manual_password"}
            disabled={creating}
          >
            <strong>Set Password Manually</strong>
            <span>
              Choose a password yourself and share the email and password
              privately.
            </span>
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
            <div className="admin-field">
              <label htmlFor="adm-name">Full name</label>
              <input
                id="adm-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                disabled={creating}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="adm-email">Email</label>
              <input
                id="adm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={creating}
              />
            </div>
            <div className="admin-field" style={{ maxWidth: 140 }}>
              <label htmlFor="adm-level">Academic level</label>
              <select
                id="adm-level"
                value={assignedLevel}
                onChange={(e) => setAssignedLevel(e.target.value)}
                disabled={creating}
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>
                ))}
              </select>
            </div>
          </div>

          {setupMethod === "manual_password" ? (
            <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
              <div className="admin-field">
                <label htmlFor="adm-password">Password</label>
                <input
                  id="adm-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={creating}
                  placeholder="At least 8 characters, letter + number"
                />
              </div>
              <div className="admin-field">
                <label htmlFor="adm-confirm">Confirm password</label>
                <input
                  id="adm-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={creating}
                />
              </div>
            </div>
          ) : (
            <p className="admin-muted" style={{ marginTop: 0 }}>
              After creation, copy the invitation link and share it on WhatsApp
              or any private channel. The invitee sets their own password on a
              secure AgriLearn page.
            </p>
          )}

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={creating}
          >
            {creating
              ? "Creating…"
              : setupMethod === "invite"
                ? "Generate invitation"
                : "Create Level Admin"}
          </button>
        </form>
      </div>

      {createdResult ? (
        <div className="admin-panel" style={{ marginBottom: "1.25rem" }}>
          <h2>
            {createdResult.setupMethod === "invite"
              ? "Invitation ready"
              : "Account created"}
          </h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            {createdResult.note}
          </p>
          <ul className="admin-dm-summary">
            <li>
              Email: <strong>{createdResult.email}</strong>
            </li>
            <li>
              Level: <strong>{createdResult.assignedLevel} Level</strong>
            </li>
            {createdResult.inviteExpiresAt ? (
              <li>
                Expires:{" "}
                <strong>{formatDate(createdResult.inviteExpiresAt)}</strong>
              </li>
            ) : null}
          </ul>

          {createdResult.inviteUrl ? (
            <div className="admin-invite-share">
              <label htmlFor="invite-url-display">Invitation link</label>
              <div className="admin-invite-row">
                <input
                  id="invite-url-display"
                  readOnly
                  value={createdResult.inviteUrl}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleCopyInvite}
                >
                  {copyState === "copied"
                    ? "Copied"
                    : "Copy Invitation Link"}
                </button>
              </div>
              {copyState === "failed" ? (
                <p className="admin-form-error">
                  Could not copy automatically. Select and copy the link
                  manually.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="admin-muted">
              Sign-in page: <strong>/admin/login</strong>. The password you set
              is not shown again for security.
            </p>
          )}
        </div>
      ) : null}

      <div className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="adm-q">Search</label>
            <input
              id="adm-q"
              type="search"
              className="agri-search"
              placeholder="Name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="admin-field" style={{ maxWidth: 160 }}>
            <label htmlFor="adm-role">Role</label>
            <select
              id="adm-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="level_admin">Level Admin</option>
            </select>
          </div>
          <div className="admin-field" style={{ maxWidth: 140 }}>
            <label htmlFor="adm-lvl-filter">Level</label>
            <select
              id="adm-lvl-filter"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="">All levels</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="admin-form-error">{error}</p> : null}
        {message ? (
          <p className="admin-muted" style={{ color: "#166534" }}>
            {message}
          </p>
        ) : null}
        {loading ? <p className="admin-muted">Loading administrators…</p> : null}

        {!loading && !administrators.length ? (
          <div className="admin-empty">
            <strong>No administrators found</strong>
            Create a Level Admin above to get started.
          </div>
        ) : null}

        {administrators.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {administrators.map((row) => {
                  const isSuper =
                    row.isSuperAdmin ||
                    row.role === "super_admin" ||
                    row.role === "admin";
                  const busy = busyId === row._id;
                  return (
                    <tr key={row._id}>
                      <td>{row.fullName}</td>
                      <td>{row.email}</td>
                      <td>
                        <span className="admin-badge">
                          {isSuper ? "Super Admin" : "Level Admin"}
                        </span>
                      </td>
                      <td>
                        {isSuper ? (
                          "All levels"
                        ) : (
                          <select
                            value={row.assignedLevel || ""}
                            disabled={busy}
                            onChange={(e) =>
                              handleChangeLevel(row, e.target.value)
                            }
                            aria-label={`Assigned level for ${row.fullName}`}
                          >
                            {LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <span
                          className="admin-badge"
                          style={
                            row.isActive === false || row.invitePending
                              ? { opacity: 0.75 }
                              : undefined
                          }
                        >
                          {statusLabel(row)}
                        </span>
                      </td>
                      <td>{formatDate(row.lastLoginAt)}</td>
                      <td>
                        {isSuper ? (
                          <span className="admin-muted">Protected</span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.35rem",
                            }}
                          >
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              disabled={busy}
                              onClick={() => handleToggleActive(row)}
                            >
                              {row.isActive === false ? "Activate" : "Deactivate"}
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              disabled={busy}
                              onClick={() => handleResendInvite(row)}
                            >
                              New invite link
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger"
                              disabled={busy}
                              onClick={() => handleRemove(row)}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default AdminAdministrators;
