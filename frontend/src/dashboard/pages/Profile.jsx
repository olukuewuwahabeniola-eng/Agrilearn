import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../components/PageHeader";
import CommunityAvatar, {
  bustAvatarCache,
} from "../components/community/CommunityAvatar";
import { uploadProfilePicture } from "../../utils/communityApi";
import {
  COMMUNITY_AVATAR_HINT,
  validateCommunityAvatarFile,
} from "../../utils/uploadLimits";
import "../components/community/community.css";

function Profile() {
  const { student, updateStudent } = useAuth();
  const fileRef = useRef(null);
  const previewUrlRef = useRef("");
  const [preview, setPreview] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const studentId = String(student?._id || student?.id || "");

  function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const invalid = validateCommunityAvatarFile(file);
    if (invalid) {
      setError(invalid);
      setPendingFile(null);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
      setPreview("");
      return;
    }
    setError("");
    setMessage("");
    setPendingFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreview = URL.createObjectURL(file);
    previewUrlRef.current = nextPreview;
    setPreview(nextPreview);
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function savePicture() {
    if (!pendingFile) return;
    setSaving(true);
    setError("");
    setUploadProgress(0);
    try {
      const data = await uploadProfilePicture(pendingFile, setUploadProgress);
      if (data.student) updateStudent(data.student);
      bustAvatarCache(studentId);
      setMessage(data.message || "Profile picture updated.");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
      setPreview("");
      setPendingFile(null);
    } catch (err) {
      setError(err.message || "Could not update your profile picture.");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

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
        <div className="profile-photo-editor">
          {preview ? (
            <img className="community-avatar lg" src={preview} alt="Preview" />
          ) : (
            <CommunityAvatar
              studentId={studentId}
              name={student?.fullName}
              hasAvatar={Boolean(student?.hasAvatar || student?.avatar?.hasAvatar)}
              className="lg big-avatar"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={chooseFile}
          />
          <div className="profile-photo-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileRef.current?.click()}
            >
              {student?.hasAvatar ? "Change picture" : "Upload picture"}
            </button>
            {pendingFile ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={savePicture}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save picture"}
              </button>
            ) : null}
          </div>
          <p className="community-upload-hint">{COMMUNITY_AVATAR_HINT}</p>
          {uploadProgress != null ? (
            <p className="community-status" role="status">
              Uploading… {uploadProgress}%
            </p>
          ) : null}
          {message ? <p className="community-status">{message}</p> : null}
          {error ? <p className="community-restricted">{error}</p> : null}
        </div>
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
