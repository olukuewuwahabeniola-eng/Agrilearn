import { useEffect, useState } from "react";
import { getInitials } from "../../data/courses";
import {
  communityAvatarUrl,
  fetchAuthorizedBlob,
} from "../../../utils/communityApi";
import { getAdminApiBaseUrl } from "../../../utils/adminApi";

const blobCache = new Map();

export function bustAvatarCache(studentId) {
  [`s:${studentId}`, `a:${studentId}`].forEach((key) => {
    const url = blobCache.get(key);
    if (url) URL.revokeObjectURL(url);
    blobCache.delete(key);
  });
}

function avatarEndpoint(studentId, admin) {
  if (admin) {
    return `${getAdminApiBaseUrl()}/api/admin/community/avatars/${studentId}`;
  }
  return communityAvatarUrl(studentId);
}

function CommunityAvatar({
  studentId,
  name,
  hasAvatar,
  admin = false,
  className = "",
}) {
  const [src, setSrc] = useState("");
  const initials = getInitials(name);

  useEffect(() => {
    if (!hasAvatar || !studentId) {
      setSrc("");
      return undefined;
    }
    const key = `${admin ? "a" : "s"}:${studentId}`;
    if (blobCache.has(key)) {
      setSrc(blobCache.get(key));
      return undefined;
    }
    let cancelled = false;
    fetchAuthorizedBlob(avatarEndpoint(studentId, admin), { admin })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        blobCache.set(key, url);
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [admin, hasAvatar, studentId]);

  if (src) {
    return (
      <img
        className={`community-avatar ${className}`.trim()}
        src={src}
        alt=""
      />
    );
  }

  return (
    <span className={`community-avatar fallback ${className}`.trim()} aria-hidden="true">
      {initials}
    </span>
  );
}

export default CommunityAvatar;
