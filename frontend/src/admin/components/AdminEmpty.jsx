import { IconSearch } from "./AdminIcons";

function AdminEmpty({ title, children, icon = <IconSearch /> }) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export default AdminEmpty;
