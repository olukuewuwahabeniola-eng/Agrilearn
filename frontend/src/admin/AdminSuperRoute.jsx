import { Navigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

/**
 * Blocks Level Admins from Super Admin–only pages (even via manual URL).
 */
function AdminSuperRoute({ children }) {
  const { admin } = useAdminAuth();
  const isSuper = Boolean(
    admin?.isSuperAdmin || admin?.role === "super_admin" || admin?.role === "admin"
  );

  if (!isSuper) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default AdminSuperRoute;
