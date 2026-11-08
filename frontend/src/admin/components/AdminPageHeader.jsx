function AdminPageHeader({ kicker = "Administration", title, children }) {
  return (
    <header className="admin-page-header">
      <span className="admin-kicker">{kicker}</span>
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
    </header>
  );
}

export default AdminPageHeader;
