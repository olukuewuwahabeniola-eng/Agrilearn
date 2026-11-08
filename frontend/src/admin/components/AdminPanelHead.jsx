function AdminPanelHead({ icon, title, lede, count }) {
  return (
    <div className="admin-panel-head">
      <div className="admin-panel-head-copy">
        {icon ? (
          <span className="admin-panel-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div>
          <h2>{title}</h2>
          {lede ? <p className="admin-panel-lede">{lede}</p> : null}
        </div>
      </div>
      {count != null && count !== "" ? (
        <span className="admin-count">{count}</span>
      ) : null}
    </div>
  );
}

export default AdminPanelHead;
