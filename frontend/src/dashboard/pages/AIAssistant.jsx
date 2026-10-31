import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import {
  deleteConversation,
  formatConversationDate,
  getConversation,
  listConversations,
} from "../../utils/conversationsApi";
import {
  formatBytes,
  formatNoteDate,
  getNote,
  listNotes,
  uploadNote,
} from "../../utils/notesApi";
import { completeQuiz } from "../../utils/dashboardApi";
import { validatePdfFile } from "../../utils/uploadLimits";
import AiMarkdown from "../components/AiMarkdown";
import PageHeader from "../components/PageHeader";
import { useLevelCourses } from "../hooks/useLevelCourses";

const WELCOME_MESSAGE = {
  role: "bot",
  text:
    "## Welcome to AgriLearn AI\n\nChoose a **course**, then pick a document from **General Materials** (official) or **My Personal Uploads**, or upload your own PDF.\n\nYour chats are saved automatically — open **Conversation History** anytime to continue where you left off.",
};

/**
 * Shared AgriLearn AI Assistant for all academic levels.
 * Persistent MongoDB conversation history + PDF library. Gemini on the backend.
 */
function AIAssistant() {
  const [params] = useSearchParams();
  const { level, courses } = useLevelCourses();
  const initialCourse = params.get("course") || "";
  const fileInputRef = useRef(null);
  const chatLogRef = useRef(null);

  const [course, setCourse] = useState(initialCourse);
  const [libraryNotes, setLibraryNotes] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [materialLibrary, setMaterialLibrary] = useState("official");
  const [selectedNote, setSelectedNote] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingQuizCourse, setPendingQuizCourse] = useState("");
  const [markingQuiz, setMarkingQuiz] = useState(false);

  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);

  const hasPdf = Boolean(selectedNote || pdfFile);

  const selectedLabel = useMemo(() => {
    const parts = [];
    if (course) {
      const match = courses.find((item) => item.code === course);
      parts.push(
        match ? `Course: ${match.code} — ${match.title}` : `Course: ${course}`
      );
    }
    if (selectedNote) {
      const src =
        selectedNote.source === "official"
          ? "General Materials (Official)"
          : "My Personal Uploads";
      parts.push(
        `${src}: ${selectedNote.title || selectedNote.originalName}`
      );
    } else if (pdfFile) {
      parts.push(`Device PDF: ${pdfFile.name}`);
    }
    return parts.length ? parts.join(" · ") : "No material selected";
  }, [course, courses, selectedNote, pdfFile]);

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return libraryNotes;
    return libraryNotes.filter((note) => {
      const hay = [
        note.title,
        note.originalName,
        note.description,
        note.courseCode,
        note.courseTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [libraryNotes, librarySearch]);

  const refreshHistory = useCallback(async (q = historySearch) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await listConversations(q);
      setHistory(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (error) {
      setHistory([]);
      setHistoryError(error.message || "Could not load conversation history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch]);

  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHistory(historySearch);
    }, historySearch ? 280 : 0);
    return () => clearTimeout(timer);
  }, [historySearch, refreshHistory]);

  useEffect(() => {
    setLibrarySearch("");

    if (!course) {
      setLibraryNotes([]);
      setLibraryError("");
      setLibraryLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLibraryLoading(true);
      setLibraryError("");
      try {
        const data = await listNotes({
          library: materialLibrary,
          courseCode: course,
        });
        if (!cancelled) {
          setLibraryNotes(Array.isArray(data.notes) ? data.notes : []);
        }
      } catch (error) {
        if (!cancelled) {
          setLibraryNotes([]);
          setLibraryError(
            error.message || "Could not load the course PDF library."
          );
        }
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [course, materialLibrary]);

  const handleCourseChange = (nextCourse) => {
    setCourse(nextCourse);
    setSelectedNote(null);
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pushBot = (text) => {
    setMessages((current) => [...current, { role: "bot", text }]);
  };

  const refreshLibrary = async (preferNoteId) => {
    if (!course) return;
    try {
      const data = await listNotes({
        library: materialLibrary,
        courseCode: course,
      });
      const notes = Array.isArray(data.notes) ? data.notes : [];
      setLibraryNotes(notes);
      if (preferNoteId) {
        const match = notes.find((note) => note.id === preferNoteId);
        if (match) setSelectedNote(match);
      }
    } catch {
      /* keep current list */
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setConversationTitle("New chat");
    setMessages([WELCOME_MESSAGE]);
    setQuestion("");
    setSelectedNote(null);
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openConversation = async (id) => {
    if (!id || loading) return;
    setLoading(true);
    try {
      const data = await getConversation(id);
      const convo = data.conversation;
      if (!convo) throw new Error("Conversation not found.");

      setConversationId(convo.id);
      setConversationTitle(convo.title || "Conversation");
      setCourse(convo.courseCode || "");
      setMessages(
        Array.isArray(convo.messages) && convo.messages.length
          ? convo.messages.map((m) => ({ role: m.role, text: m.text }))
          : [WELCOME_MESSAGE]
      );
      setSelectedNote(null);
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (convo.noteId) {
        try {
          const noteData = await getNote(convo.noteId);
          if (noteData?.note) {
            setSelectedNote(noteData.note);
            setMaterialLibrary(
              noteData.note.source === "personal" ? "personal" : "official"
            );
          }
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      pushBot(error.message || "Could not open that conversation.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (id, title) => {
    if (!id) return;
    const ok = window.confirm(
      `Delete “${title || "this conversation"}”? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await deleteConversation(id);
      if (conversationId === id) {
        startNewChat();
      }
      await refreshHistory(historySearch);
    } catch (error) {
      setHistoryError(error.message || "Could not delete conversation.");
    }
  };

  const runAction = async (action, userText) => {
    if (loading) return;

    setMessages((current) => [...current, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("action", action);
      form.append("question", userText);
      if (course) form.append("courseCode", course);
      if (conversationId) form.append("conversationId", conversationId);

      if (pdfFile) {
        form.append("pdf", pdfFile);
      } else if (selectedNote?.id) {
        form.append("noteId", selectedNote.id);
      }

      const data = await apiFetch("/api/ai/assist", {
        method: "POST",
        body: form,
      });

      pushBot(data.reply || "No reply was returned.");

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      if (data.conversation?.title) {
        setConversationTitle(data.conversation.title);
      }

      if (action === "quiz" && course) {
        setPendingQuizCourse(course);
      }

      if (pdfFile && course) {
        setPdfFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await refreshLibrary(data.noteId || null);
      }

      await refreshHistory(historySearch);
    } catch (error) {
      pushBot(
        error.message ||
          "Could not reach the AI Assistant right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;
    setQuestion("");
    await runAction("ask", text);
  };

  const handleMarkQuizCompleted = async () => {
    if (!pendingQuizCourse || markingQuiz) return;
    const courseCode = pendingQuizCourse;
    setMarkingQuiz(true);
    try {
      const data = await completeQuiz({
        courseCode,
        quizTitle: `AI practice quiz — ${courseCode}`,
      });
      setPendingQuizCourse("");
      pushBot(
        data.message ||
          `Quiz marked as completed for ${courseCode}. Your dashboard quiz count is now updated.`
      );
    } catch (error) {
      pushBot(error.message || "Could not mark the quiz as completed.");
    } finally {
      setMarkingQuiz(false);
    }
  };

  const handlePdfChange = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    const sizeError = validatePdfFile(file);
    if (sizeError) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      pushBot(sizeError);
      return;
    }

    if (!course) {
      setPdfFile(file);
      setSelectedNote(null);
      pushBot(
        "PDF selected from your device. Choose a course so it can be saved to your AgriLearn library, or continue using it for this chat only."
      );
      return;
    }

    setUploading(true);
    try {
      const data = await uploadNote({
        file,
        courseCode: course,
        title: file.name.replace(/\.pdf$/i, ""),
        description: "Personal upload from AI Assistant",
      });
      setPdfFile(null);
      setMaterialLibrary("personal");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshLibrary(data.note?.id);
      pushBot(
        data.duplicated
          ? `**${data.note?.title || file.name}** is already in My Personal Uploads — selected for AI.`
          : `**${data.note?.title || file.name}** was saved to My Personal Uploads and selected for AI.`
      );
    } catch (error) {
      setSelectedNote(null);
      setPdfFile(file);
      pushBot(
        error.message ||
          "Could not save to the library. The PDF is still available for this chat from your device."
      );
    } finally {
      setUploading(false);
    }
  };

  const clearPdfSelection = () => {
    setSelectedNote(null);
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectLibraryNote = (note) => {
    setSelectedNote(note);
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="page-hero ai-page">
      <PageHeader
        title="AI Assistant"
        subtitle={`Ask questions, summarise notes, and generate quizzes for your ${level} Level courses.`}
      />

      <div className="ai-chat-toolbar">
        <button
          type="button"
          className="btn btn-primary ai-new-chat-btn"
          onClick={startNewChat}
          disabled={loading}
        >
          New Chat
        </button>
        <div className="ai-chat-toolbar-meta">
          <strong>{conversationTitle}</strong>
          <span>
            {conversationId
              ? "Saved to your account"
              : "Starts saving after your first message"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-outline ai-history-toggle"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? "Hide History" : "Show History"}
        </button>
      </div>

      <div className={`ai-layout ai-layout-with-history${historyOpen ? "" : " history-collapsed"}`}>
        <aside className={`ai-history${historyOpen ? "" : " is-collapsed"}`}>
          <div className="ai-history-head">
            <h3>Conversation History</h3>
            <span>{history.length}</span>
          </div>

          <label className="sr-only" htmlFor="ai-history-search">
            Search conversations
          </label>
          <input
            id="ai-history-search"
            type="search"
            className="ai-history-search"
            placeholder="Search your chats…"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />

          {historyError ? (
            <p className="ai-history-error">{historyError}</p>
          ) : null}

          <div className="ai-history-list" role="list">
            {historyLoading ? (
              <p className="ai-history-empty">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="ai-history-empty">
                {historySearch.trim()
                  ? "No conversations match your search."
                  : "No saved conversations yet. Send a message to start one."}
              </p>
            ) : (
              history.map((item) => {
                const active = conversationId === item.id;
                return (
                  <div
                    key={item.id}
                    role="listitem"
                    className={`ai-history-item${active ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="ai-history-open"
                      onClick={() => openConversation(item.id)}
                      disabled={loading}
                    >
                      <span className="ai-history-title">{item.title}</span>
                      <span className="ai-history-meta">
                        {item.courseCode
                          ? `${item.courseCode} · `
                          : `${item.level || level} Level · `}
                        {formatConversationDate(item.updatedAt)}
                      </span>
                      {item.preview ? (
                        <span className="ai-history-preview">{item.preview}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="ai-history-delete"
                      title="Delete conversation"
                      aria-label={`Delete ${item.title}`}
                      onClick={() =>
                        handleDeleteConversation(item.id, item.title)
                      }
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <div className="ai-chat">
          <div className="ai-chat-log" ref={chatLogRef} aria-live="polite">
            {messages.map((msg, index) => (
              <article
                key={`${msg.role}-${index}-${msg.text?.slice(0, 12) || ""}`}
                className={`ai-row ${msg.role}`}
              >
                <div className="ai-avatar" aria-hidden="true">
                  {msg.role === "bot" ? "AI" : "You"}
                </div>
                <div className={`ai-bubble ${msg.role}`}>
                  {msg.role === "bot" ? (
                    <AiMarkdown content={msg.text} />
                  ) : (
                    <p className="ai-user-text">{msg.text}</p>
                  )}
                </div>
              </article>
            ))}

            {loading && (
              <article className="ai-row bot ai-loading-row">
                <div className="ai-avatar" aria-hidden="true">
                  AI
                </div>
                <div className="ai-bubble bot ai-loading-bubble">
                  <span className="ai-loading-label">Generating response</span>
                  <span className="ai-typing" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </article>
            )}
          </div>

          <form className="ai-compose" onSubmit={handleAsk}>
            <textarea
              rows={2}
              placeholder="Ask a question about your course or PDF..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading && question.trim()) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>

        <aside className="ai-side">
          <h3 className="ai-side-title">Study tools</h3>

          <label htmlFor="ai-course">Select a course ({level} Level)</label>
          <select
            id="ai-course"
            value={course}
            onChange={(e) => handleCourseChange(e.target.value)}
            disabled={loading || uploading}
          >
            <option value="">Choose course</option>
            {courses.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.title}
              </option>
            ))}
          </select>

          <div className="ai-library">
            <div className="ai-library-head">
              <h4>Course materials</h4>
              <span>
                {course
                  ? libraryLoading
                    ? "Loading…"
                    : `${filteredLibrary.length} PDF${filteredLibrary.length === 1 ? "" : "s"}`
                  : "Select a course"}
              </span>
            </div>

            <div className="material-library-tabs compact" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={materialLibrary === "official"}
                className={`material-library-tab${materialLibrary === "official" ? " active" : ""}`}
                onClick={() => {
                  setMaterialLibrary("official");
                  setSelectedNote(null);
                }}
                disabled={!course || loading || uploading}
              >
                General
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={materialLibrary === "personal"}
                className={`material-library-tab${materialLibrary === "personal" ? " active" : ""}`}
                onClick={() => {
                  setMaterialLibrary("personal");
                  setSelectedNote(null);
                }}
                disabled={!course || loading || uploading}
              >
                My Uploads
              </button>
            </div>

            {!course ? (
              <p className="ai-library-empty">
                Choose a course to browse official materials and your personal uploads.
              </p>
            ) : (
              <>
                <p className="ai-library-source-label">
                  {materialLibrary === "official"
                    ? "General Materials — official AgriLearn PDFs"
                    : "My Personal Uploads — private to you"}
                </p>
                <label className="sr-only" htmlFor="ai-library-search">
                  Search PDFs in this course
                </label>
                <input
                  id="ai-library-search"
                  type="search"
                  className="ai-library-search"
                  placeholder="Search titles, files, descriptions…"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  disabled={libraryLoading}
                />

                {libraryError ? (
                  <p className="ai-library-error">{libraryError}</p>
                ) : null}

                <div className="ai-library-list" role="list">
                  {libraryLoading ? (
                    <p className="ai-library-empty">Loading course PDFs…</p>
                  ) : filteredLibrary.length === 0 ? (
                    <p className="ai-library-empty">
                      {librarySearch.trim()
                        ? "No PDFs match your search in this course."
                        : materialLibrary === "official"
                          ? "No official PDFs for this course yet."
                          : "No personal uploads for this course yet. Upload below."}
                    </p>
                  ) : (
                    filteredLibrary.map((note) => {
                      const active = selectedNote?.id === note.id;
                      return (
                        <button
                          key={note.id}
                          type="button"
                          role="listitem"
                          className={`ai-library-item${active ? " active" : ""}`}
                          onClick={() => selectLibraryNote(note)}
                          disabled={loading || uploading}
                        >
                          <span className="ai-library-item-title">
                            {note.title}
                            <span className="ai-library-item-source">
                              {note.source === "official" ? "Official" : "Personal"}
                            </span>
                          </span>
                          <span className="ai-library-item-meta">
                            {note.originalName}
                            {note.size ? ` · ${formatBytes(note.size)}` : ""}
                          </span>
                          {note.description ? (
                            <span className="ai-library-item-desc">
                              {note.description}
                            </span>
                          ) : null}
                          <span className="ai-library-item-date">
                            {formatNoteDate(note.createdAt)}
                            {active ? " · Selected" : ""}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <label htmlFor="ai-pdf">Upload to My Personal Uploads (PDF, max 25 MB)</label>
          <input
            id="ai-pdf"
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            disabled={loading || uploading}
            onChange={handlePdfChange}
          />
          {uploading && (
            <p className="ai-upload-status">Saving to My Personal Uploads…</p>
          )}
          {hasPdf && (
            <button
              type="button"
              className="link-btn"
              onClick={clearPdfSelection}
              disabled={loading || uploading}
            >
              Clear PDF selection
            </button>
          )}

          <p className="ai-notice">{selectedLabel}</p>

          <div className="ai-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || uploading || !hasPdf}
              onClick={() =>
                runAction(
                  "summarise",
                  `Please summarise my lecture notes (${selectedLabel}). Use clear Markdown headings and bullet points.`
                )
              }
            >
              Summarise Notes
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={loading || uploading || (!course && !hasPdf)}
              onClick={() =>
                runAction(
                  "quiz",
                  `Please generate a practice quiz from ${selectedLabel}. Use Markdown with a Questions section and a separate Answer Key section.`
                )
              }
            >
              Generate Quiz
            </button>
            {pendingQuizCourse ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={markingQuiz || loading}
                onClick={handleMarkQuizCompleted}
              >
                {markingQuiz
                  ? "Saving…"
                  : `Mark ${pendingQuizCourse} quiz completed`}
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default AIAssistant;
