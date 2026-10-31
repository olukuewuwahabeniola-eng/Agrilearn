import { useEffect, useMemo, useState } from "react";
import {
  clearActivity,
  deleteResources,
  deleteTestStudents,
  downloadJsonExport,
  exportActivity,
  exportResources,
  exportStudents,
  getActivityCleanupStats,
  listDataAuditLogs,
  listDataResources,
  listManagedStudents,
  previewActivityClear,
  previewResourceDeletion,
  previewStudentDeletion,
  setStudentTestFlag,
} from "../../utils/adminDataManagementApi";

const TABS = [
  { id: "resources", label: "Uploaded resources" },
  { id: "students", label: "Test student accounts" },
  { id: "activity", label: "Testing activity" },
  { id: "audit", label: "Cleanup audit log" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function ConfirmPanel({
  title,
  summaryLines,
  confirmPhrase,
  setConfirmPhrase,
  busy,
  onCancel,
  onConfirm,
  confirmLabel,
}) {
  return (
    <div className="admin-panel admin-dm-confirm">
      <h3>{title}</h3>
      <ul className="admin-dm-summary">
        {summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="admin-muted">
        This cannot be undone. Type <strong>DELETE</strong> to confirm.
      </p>
      <div className="admin-toolbar">
        <div className="admin-field">
          <label htmlFor="dm-confirm">Confirmation</label>
          <input
            id="dm-confirm"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="admin-dm-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={onConfirm}
          disabled={busy || confirmPhrase.trim() !== "DELETE"}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function AdminDataManagement() {
  const [tab, setTab] = useState("resources");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Resources
  const [resources, setResources] = useState([]);
  const [resLoading, setResLoading] = useState(false);
  const [resType, setResType] = useState("all");
  const [resLevel, setResLevel] = useState("");
  const [resCourse, setResCourse] = useState("");
  const [resQ, setResQ] = useState("");
  const [selectedResources, setSelectedResources] = useState(() => new Set());
  const [resPreview, setResPreview] = useState(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  // Students
  const [students, setStudents] = useState([]);
  const [stuLoading, setStuLoading] = useState(false);
  const [stuQ, setStuQ] = useState("");
  const [stuLevel, setStuLevel] = useState("");
  const [testOnly, setTestOnly] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState(() => new Set());
  const [stuPreview, setStuPreview] = useState(null);

  // Activity
  const [actStats, setActStats] = useState(null);
  const [actScope, setActScope] = useState("test_selected");
  const [clearActivities, setClearActivities] = useState(true);
  const [clearQuizzes, setClearQuizzes] = useState(true);
  const [clearProgress, setClearProgress] = useState(true);
  const [actPreview, setActPreview] = useState(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const selectedResourceRows = useMemo(
    () => resources.filter((r) => selectedResources.has(`${r.kind}:${r.id}`)),
    [resources, selectedResources]
  );

  const loadResources = async () => {
    setResLoading(true);
    setError("");
    try {
      const data = await listDataResources({
        type: resType,
        level: resLevel,
        courseCode: resCourse.trim(),
        q: resQ.trim(),
      });
      setResources(Array.isArray(data.resources) ? data.resources : []);
    } catch (err) {
      setResources([]);
      setError(err.message || "Could not load resources.");
    } finally {
      setResLoading(false);
    }
  };

  const loadStudents = async () => {
    setStuLoading(true);
    setError("");
    try {
      const data = await listManagedStudents({
        q: stuQ.trim(),
        level: stuLevel,
        testOnly: testOnly ? "1" : "",
      });
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err) {
      setStudents([]);
      setError(err.message || "Could not load students.");
    } finally {
      setStuLoading(false);
    }
  };

  const loadActivityStats = async () => {
    try {
      const data = await getActivityCleanupStats();
      setActStats(data.stats || null);
    } catch (err) {
      setError(err.message || "Could not load activity stats.");
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const data = await listDataAuditLogs();
      setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setAuditLogs([]);
      setError(err.message || "Could not load audit log.");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "resources") loadResources();
    if (tab === "students") loadStudents();
    if (tab === "activity") {
      loadActivityStats();
      loadStudents();
    }
    if (tab === "audit") loadAudit();
    setResPreview(null);
    setStuPreview(null);
    setActPreview(null);
    setConfirmPhrase("");
    setStatus("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "resources") return undefined;
    const timer = setTimeout(() => loadResources(), resQ ? 280 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resType, resLevel, resCourse, resQ]);

  useEffect(() => {
    if (tab !== "students" && tab !== "activity") return undefined;
    const timer = setTimeout(() => loadStudents(), stuQ ? 280 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuQ, stuLevel, testOnly]);

  const toggleResource = (row) => {
    const key = `${row.kind}:${row.id}`;
    setSelectedResources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllResources = () => {
    if (selectedResources.size === resources.length) {
      setSelectedResources(new Set());
      return;
    }
    setSelectedResources(
      new Set(resources.map((r) => `${r.kind}:${r.id}`))
    );
  };

  const splitResourceSelection = () => {
    const noteIds = [];
    const pastQuestionIds = [];
    selectedResourceRows.forEach((row) => {
      if (row.kind === "note") noteIds.push(row.id);
      else pastQuestionIds.push(row.id);
    });
    return { noteIds, pastQuestionIds };
  };

  const beginResourceDelete = async () => {
    setError("");
    setStatus("");
    const body = splitResourceSelection();
    if (!body.noteIds.length && !body.pastQuestionIds.length) {
      setError("Select at least one resource.");
      return;
    }
    setBusy(true);
    try {
      const data = await previewResourceDeletion(body);
      setResPreview(data);
      setConfirmPhrase("");
    } catch (err) {
      setError(err.message || "Could not prepare deletion preview.");
    } finally {
      setBusy(false);
    }
  };

  const runResourceExport = async () => {
    setBusy(true);
    setError("");
    try {
      const body = splitResourceSelection();
      const data = await exportResources(body);
      downloadJsonExport(
        `agrilearn-resources-export-${Date.now()}.json`,
        data.export
      );
      setStatus("Resource export downloaded.");
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmResourceDelete = async () => {
    setBusy(true);
    setError("");
    try {
      const body = {
        ...splitResourceSelection(),
        confirmPhrase,
      };
      const data = await deleteResources(body);
      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
      setStatus(
        failedCount
          ? `${data.message || "Partial cleanup."} Deleted notes: ${(data.deleted?.noteIds || []).length}; past questions: ${(data.deleted?.pastQuestionIds || []).length}; failed: ${failedCount}.`
          : data.message || "Resources deleted."
      );
      if (failedCount) {
        setError(
          data.failed
            .map((row) => `${row.id}: ${row.reason}`)
            .slice(0, 5)
            .join(" · ")
        );
      }
      setResPreview(null);
      setSelectedResources(new Set());
      setConfirmPhrase("");
      await loadResources();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTestFlag = async (student, nextValue) => {
    setBusy(true);
    setError("");
    try {
      await setStudentTestFlag(student.id || student._id, nextValue);
      setStatus(
        nextValue
          ? `Marked ${student.email} as a test account.`
          : `Removed test mark from ${student.email}.`
      );
      await loadStudents();
    } catch (err) {
      setError(err.message || "Could not update test flag.");
    } finally {
      setBusy(false);
    }
  };

  const beginStudentDelete = async () => {
    const studentIds = [...selectedStudents];
    if (!studentIds.length) {
      setError("Select at least one marked test account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await previewStudentDeletion({ studentIds });
      setStuPreview(data);
      setConfirmPhrase("");
    } catch (err) {
      setError(err.message || "Could not prepare student deletion preview.");
    } finally {
      setBusy(false);
    }
  };

  const runStudentExport = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await exportStudents({
        studentIds: [...selectedStudents],
      });
      downloadJsonExport(
        `agrilearn-students-export-${Date.now()}.json`,
        data.export
      );
      setStatus("Student export downloaded.");
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmStudentDelete = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await deleteTestStudents({
        studentIds: [...selectedStudents],
        confirmPhrase,
      });
      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
      const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;
      const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setStatus(
        `${data.message || "Cleanup finished."} Deleted: ${deletedCount}; skipped: ${skippedCount}; failed: ${failedCount}.`
      );
      if (failedCount) {
        setError(
          data.failed
            .map((row) => `${row.email || row.id}: ${row.reason}`)
            .slice(0, 5)
            .join(" · ")
        );
      }
      setStuPreview(null);
      setSelectedStudents(new Set());
      setConfirmPhrase("");
      await loadStudents();
      await loadActivityStats();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const beginActivityClear = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await previewActivityClear({
        scope: actScope,
        studentIds: [...selectedStudents],
        clearActivities,
        clearQuizzes,
        clearProgress,
      });
      setActPreview(data);
      setConfirmPhrase("");
    } catch (err) {
      setError(err.message || "Could not prepare activity cleanup preview.");
    } finally {
      setBusy(false);
    }
  };

  const runActivityExport = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await exportActivity({
        scope: actScope,
        studentIds: [...selectedStudents],
      });
      downloadJsonExport(
        `agrilearn-activity-export-${Date.now()}.json`,
        data.export
      );
      setStatus("Activity export downloaded.");
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmActivityClear = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await clearActivity({
        scope: actScope,
        studentIds: [...selectedStudents],
        clearActivities,
        clearQuizzes,
        clearProgress,
        confirmPhrase,
      });
      setStatus(data.message || "Testing activity cleared.");
      setActPreview(null);
      setConfirmPhrase("");
      await loadActivityStats();
    } catch (err) {
      setError(err.message || "Cleanup failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Data Management</h1>
        <p>
          Safe testing cleanup for uploads, marked test accounts, and activity
          records. Administrator accounts and unmarked students are protected.
        </p>
      </header>

      <div className="admin-act-filter-pills" style={{ marginBottom: "1rem" }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}
      {status ? <p className="admin-form-success">{status}</p> : null}

      {tab === "resources" ? (
        <>
          <div className="admin-panel">
            <div className="admin-toolbar">
              <div className="admin-field">
                <label htmlFor="dm-res-type">Resource type</label>
                <select
                  id="dm-res-type"
                  value={resType}
                  onChange={(e) => setResType(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="official_note">Official lecture notes</option>
                  <option value="personal_note">Student personal uploads</option>
                  <option value="past_question">Past questions</option>
                </select>
              </div>
              <div className="admin-field" style={{ maxWidth: 140 }}>
                <label htmlFor="dm-res-level">Level</label>
                <select
                  id="dm-res-level"
                  value={resLevel}
                  onChange={(e) => setResLevel(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="500">500</option>
                </select>
              </div>
              <div className="admin-field" style={{ maxWidth: 140 }}>
                <label htmlFor="dm-res-course">Course</label>
                <input
                  id="dm-res-course"
                  value={resCourse}
                  onChange={(e) => setResCourse(e.target.value)}
                  placeholder="e.g. CHM101"
                />
              </div>
              <div className="admin-field">
                <label htmlFor="dm-res-q">Search</label>
                <input
                  id="dm-res-q"
                  type="search"
                  value={resQ}
                  onChange={(e) => setResQ(e.target.value)}
                  placeholder="Title or course…"
                />
              </div>
            </div>

            <div className="admin-dm-actions" style={{ marginBottom: "0.85rem" }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={runResourceExport}
                disabled={busy || !selectedResources.size}
              >
                Export selected
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={beginResourceDelete}
                disabled={busy || !selectedResources.size}
              >
                Preview & delete selected
              </button>
            </div>

            {resLoading ? <p className="admin-muted">Loading resources…</p> : null}

            {!resLoading && !resources.length ? (
              <div className="admin-empty">
                <strong>No resources found</strong>
                Adjust filters or upload materials first.
              </div>
            ) : null}

            {resources.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            resources.length > 0 &&
                            selectedResources.size === resources.length
                          }
                          onChange={toggleAllResources}
                          aria-label="Select all resources"
                        />
                      </th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Course</th>
                      <th>Level</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((row) => {
                      const key = `${row.kind}:${row.id}`;
                      return (
                        <tr key={key}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedResources.has(key)}
                              onChange={() => toggleResource(row)}
                              aria-label={`Select ${row.title}`}
                            />
                          </td>
                          <td>{row.title}</td>
                          <td>
                            {row.resourceType === "official_note"
                              ? "Official note"
                              : row.resourceType === "personal_note"
                                ? "Personal upload"
                                : "Past question"}{" "}
                            · {row.fileType}
                          </td>
                          <td>{row.courseCode}</td>
                          <td>{row.level}</td>
                          <td>{formatDate(row.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {resPreview ? (
            <ConfirmPanel
              title="Confirm resource deletion"
              summaryLines={[
                `${resPreview.summary?.notes || 0} lecture note(s)`,
                `${resPreview.summary?.pastQuestions || 0} past question paper(s)`,
                `${resPreview.summary?.files || 0} stored file(s)`,
                `${resPreview.summary?.officialNotes || 0} official · ${resPreview.summary?.personalNotes || 0} personal`,
              ]}
              confirmPhrase={confirmPhrase}
              setConfirmPhrase={setConfirmPhrase}
              busy={busy}
              onCancel={() => setResPreview(null)}
              onConfirm={confirmResourceDelete}
              confirmLabel="Permanently delete resources"
            />
          ) : null}
        </>
      ) : null}

      {tab === "students" ? (
        <>
          <div className="admin-panel">
            <p className="admin-muted" style={{ marginBottom: "0.85rem" }}>
              Accounts are never treated as test data automatically. Mark an
              account as a test account before it can be removed.
            </p>
            <div className="admin-toolbar">
              <div className="admin-field">
                <label htmlFor="dm-stu-q">Search</label>
                <input
                  id="dm-stu-q"
                  type="search"
                  value={stuQ}
                  onChange={(e) => setStuQ(e.target.value)}
                  placeholder="Name or email…"
                />
              </div>
              <div className="admin-field" style={{ maxWidth: 140 }}>
                <label htmlFor="dm-stu-level">Level</label>
                <select
                  id="dm-stu-level"
                  value={stuLevel}
                  onChange={(e) => setStuLevel(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="500">500</option>
                </select>
              </div>
              <label className="admin-pq-check" style={{ alignSelf: "end" }}>
                <input
                  type="checkbox"
                  checked={testOnly}
                  onChange={(e) => setTestOnly(e.target.checked)}
                />
                Show marked test accounts only
              </label>
            </div>

            <div className="admin-dm-actions" style={{ marginBottom: "0.85rem" }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={runStudentExport}
                disabled={busy || !selectedStudents.size}
              >
                Export selected
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={beginStudentDelete}
                disabled={busy || !selectedStudents.size}
              >
                Preview & remove test accounts
              </button>
            </div>

            {stuLoading ? <p className="admin-muted">Loading students…</p> : null}

            {students.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Student</th>
                      <th>Level</th>
                      <th>Test account</th>
                      <th>Related records</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const id = student.id || student._id;
                      return (
                        <tr key={id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(id)}
                              disabled={!student.isTestAccount}
                              onChange={() => toggleStudent(id)}
                              aria-label={`Select ${student.email}`}
                            />
                          </td>
                          <td>
                            <strong>{student.fullName}</strong>
                            <div className="admin-muted">{student.email}</div>
                          </td>
                          <td>{student.level}</td>
                          <td>{student.isTestAccount ? "Yes" : "No"}</td>
                          <td>{student.related?.total ?? 0}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-link-btn"
                              disabled={busy || student.isAdminEmail}
                              onClick={() =>
                                handleTestFlag(student, !student.isTestAccount)
                              }
                            >
                              {student.isTestAccount
                                ? "Unmark test"
                                : "Mark as test account"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {stuPreview ? (
            <ConfirmPanel
              title="Confirm test account removal"
              summaryLines={[
                `${stuPreview.summary?.students || 0} test account(s)`,
                `${stuPreview.summary?.relatedRecords || 0} related record(s)`,
                `${stuPreview.summary?.skippedNonTest || 0} unmarked account(s) skipped`,
                stuPreview.note || "",
              ].filter(Boolean)}
              confirmPhrase={confirmPhrase}
              setConfirmPhrase={setConfirmPhrase}
              busy={busy}
              onCancel={() => setStuPreview(null)}
              onConfirm={confirmStudentDelete}
              confirmLabel="Permanently remove test accounts"
            />
          ) : null}
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          <div className="admin-panel">
            <p className="admin-muted" style={{ marginBottom: "0.85rem" }}>
              Clears quiz attempts, learning progress, and activity history for
              marked test accounts only. Course catalogs and unmarked students
              stay intact.
            </p>

            {actStats ? (
              <div className="admin-dm-stats">
                <div>
                  <strong>{actStats.testAccountCount}</strong>
                  <span>Marked test accounts</span>
                </div>
                <div>
                  <strong>{actStats.testAccountsOnly?.activities || 0}</strong>
                  <span>Test activity rows</span>
                </div>
                <div>
                  <strong>{actStats.testAccountsOnly?.quizAttempts || 0}</strong>
                  <span>Test quiz attempts</span>
                </div>
                <div>
                  <strong>
                    {actStats.testAccountsOnly?.topicCompletions || 0}
                  </strong>
                  <span>Test progress rows</span>
                </div>
              </div>
            ) : null}

            <div className="admin-toolbar">
              <div className="admin-field">
                <label htmlFor="dm-act-scope">Scope</label>
                <select
                  id="dm-act-scope"
                  value={actScope}
                  onChange={(e) => setActScope(e.target.value)}
                >
                  <option value="test_selected">
                    Selected marked test accounts
                  </option>
                  <option value="test_all">All marked test accounts</option>
                </select>
              </div>
            </div>

            <div className="admin-dm-checks">
              <label>
                <input
                  type="checkbox"
                  checked={clearActivities}
                  onChange={(e) => setClearActivities(e.target.checked)}
                />
                Student activity history
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={clearQuizzes}
                  onChange={(e) => setClearQuizzes(e.target.checked)}
                />
                Quiz attempts / scores
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={clearProgress}
                  onChange={(e) => setClearProgress(e.target.checked)}
                />
                Learning progress (topic completions)
              </label>
            </div>

            {actScope === "test_selected" ? (
              <div className="admin-table-wrap" style={{ marginTop: "0.85rem" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Test student</th>
                      <th>Related</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => s.isTestAccount)
                      .map((student) => {
                        const id = student.id || student._id;
                        return (
                          <tr key={id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedStudents.has(id)}
                                onChange={() => toggleStudent(id)}
                              />
                            </td>
                            <td>
                              {student.fullName}
                              <div className="admin-muted">{student.email}</div>
                            </td>
                            <td>{student.related?.total ?? 0}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!students.some((s) => s.isTestAccount) ? (
                  <p className="admin-muted">
                    No marked test accounts yet. Mark accounts in the Test
                    student accounts tab first.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="admin-dm-actions" style={{ marginTop: "0.85rem" }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={runActivityExport}
                disabled={busy}
              >
                Export before cleanup
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={beginActivityClear}
                disabled={busy}
              >
                Preview & clear selected types
              </button>
            </div>
          </div>

          {actPreview ? (
            <ConfirmPanel
              title="Confirm testing activity cleanup"
              summaryLines={[
                `${actPreview.summary?.students || 0} test account(s) in scope`,
                `${actPreview.summary?.activities || 0} activity row(s)`,
                `${actPreview.summary?.quizAttempts || 0} quiz attempt(s)`,
                `${actPreview.summary?.topicCompletions || 0} progress row(s)`,
                actPreview.note || "",
              ].filter(Boolean)}
              confirmPhrase={confirmPhrase}
              setConfirmPhrase={setConfirmPhrase}
              busy={busy}
              onCancel={() => setActPreview(null)}
              onConfirm={confirmActivityClear}
              confirmLabel="Permanently clear testing activity"
            />
          ) : null}
        </>
      ) : null}

      {tab === "audit" ? (
        <div className="admin-panel">
          <p className="admin-muted" style={{ marginBottom: "0.85rem" }}>
            Recent bulk cleanup actions for accountability.
          </p>
          {auditLoading ? <p className="admin-muted">Loading audit log…</p> : null}
          {!auditLoading && !auditLogs.length ? (
            <div className="admin-empty">
              <strong>No cleanup actions logged yet</strong>
            </div>
          ) : null}
          {auditLogs.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td>{log.adminEmail}</td>
                      <td>{log.action}</td>
                      <td>{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default AdminDataManagement;
