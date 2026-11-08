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
import {
  validateImageFile,
  validatePdfFile,
} from "../../utils/uploadLimits";
import AiMarkdown from "../components/AiMarkdown";
import { useLevelCourses } from "../hooks/useLevelCourses";
import "./ai-assistant.css";

function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2 13.7 8.3 20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2.2Z" />
    </svg>
  );
}

function IconPlane() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 11.5 20 4.5 13.2 21l-2.1-7.2L3.5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Shared AgriLearn AI Assistant for all academic levels.
 * Visual layout follows the project-root reference; chat behaviour follows ChatGPT.
 */
function AIAssistant() {
  const [params] = useSearchParams();
  const { level, courses } = useLevelCourses();
  const initialCourse = params.get("course") || "";

  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const chatLogRef = useRef(null);
  const plusMenuRef = useRef(null);

  const [course, setCourse] = useState(initialCourse);
  const [libraryNotes, setLibraryNotes] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [pickerLibrary, setPickerLibrary] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingQuizCourse, setPendingQuizCourse] = useState("");
  const [markingQuiz, setMarkingQuiz] = useState(false);

  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [messages, setMessages] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [plusOpen, setPlusOpen] = useState(false);

  const hasAttachment = Boolean(selectedNote || pdfFile || imageFile);
  const conversationStarted = messages.some((msg) => msg.role === "user");

  const attachmentChips = useMemo(() => {
    const chips = [];
    if (selectedNote) {
      chips.push({
        id: `note-${selectedNote.id}`,
        label: selectedNote.title || selectedNote.originalName,
        meta:
          selectedNote.source === "official"
            ? "General Materials"
            : "My Uploads",
        kind: "note",
      });
    }
    if (pdfFile) {
      chips.push({
        id: `pdf-${pdfFile.name}-${pdfFile.size}`,
        label: pdfFile.name,
        meta: "Device PDF",
        kind: "pdf",
      });
    }
    if (imageFile) {
      chips.push({
        id: `img-${imageFile.name}-${imageFile.size}`,
        label: imageFile.name,
        meta: "Device image",
        kind: "image",
      });
    }
    return chips;
  }, [selectedNote, pdfFile, imageFile]);

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

  const refreshHistory = useCallback(
    async (q = historySearch) => {
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
    },
    [historySearch]
  );

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
    if (!pickerLibrary) {
      setLibraryNotes([]);
      setLibraryError("");
      setLibraryLoading(false);
      return;
    }
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
          library: pickerLibrary,
          courseCode: course,
        });
        if (!cancelled) {
          setLibraryNotes(Array.isArray(data.notes) ? data.notes : []);
        }
      } catch (error) {
        if (!cancelled) {
          setLibraryNotes([]);
          setLibraryError(
            error.message || "Could not load materials for this course."
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
  }, [course, pickerLibrary]);

  useEffect(() => {
    if (!plusOpen) return undefined;
    const onPointerDown = (event) => {
      if (!plusMenuRef.current?.contains(event.target)) {
        setPlusOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPlusOpen(false);
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [plusOpen]);

  const pushBot = (text) => {
    setMessages((current) => [...current, { role: "bot", text }]);
  };

  const refreshLibrary = async (preferNoteId, library = "personal") => {
    if (!course) return;
    try {
      const data = await listNotes({
        library,
        courseCode: course,
      });
      const notes = Array.isArray(data.notes) ? data.notes : [];
      if (pickerLibrary === library) setLibraryNotes(notes);
      if (preferNoteId) {
        const match = notes.find((note) => note.id === preferNoteId);
        if (match) {
          setSelectedNote(match);
          setPdfFile(null);
          setImageFile(null);
        }
      }
    } catch {
      /* keep current list */
    }
  };

  const clearAttachments = () => {
    setSelectedNote(null);
    setPdfFile(null);
    setImageFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const startNewChat = () => {
    setConversationId(null);
    setConversationTitle("New chat");
    setMessages([]);
    setQuestion("");
    clearAttachments();
    setPickerLibrary(null);
    setPlusOpen(false);
    setHistoryOpen(false);
  };

  const openConversation = async (id) => {
    if (!id || loading) return;
    setLoading(true);
    setHistoryOpen(false);
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
          : []
      );
      clearAttachments();
      setPickerLibrary(null);

      if (convo.noteId) {
        try {
          const noteData = await getNote(convo.noteId);
          if (noteData?.note) setSelectedNote(noteData.note);
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
      if (conversationId === id) startNewChat();
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

      if (imageFile) {
        form.append("image", imageFile);
      } else if (pdfFile) {
        form.append("pdf", pdfFile);
      } else if (selectedNote?.id) {
        form.append("noteId", selectedNote.id);
      }

      const data = await apiFetch("/api/ai/assist", {
        method: "POST",
        body: form,
      });

      pushBot(data.reply || "No reply was returned.");

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.conversation?.title) {
        setConversationTitle(data.conversation.title);
      }

      if (action === "quiz" && course) setPendingQuizCourse(course);

      if (pdfFile && course) {
        setPdfFile(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
        await refreshLibrary(data.noteId || null, "personal");
      }
      if (imageFile) {
        setImageFile(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
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
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      pushBot(sizeError);
      return;
    }

    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setSelectedNote(null);

    if (!course) {
      setPdfFile(file);
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
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      await refreshLibrary(data.note?.id, "personal");
      pushBot(
        data.duplicated
          ? `**${data.note?.title || file.name}** is already in My Personal Uploads — attached for AI.`
          : `**${data.note?.title || file.name}** was saved to My Personal Uploads and attached.`
      );
    } catch (error) {
      setPdfFile(file);
      pushBot(
        error.message ||
          "Could not save to the library. The PDF is still attached for this chat."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    const sizeError = validateImageFile(file);
    if (sizeError) {
      if (imageInputRef.current) imageInputRef.current.value = "";
      pushBot(sizeError);
      return;
    }
    setPdfFile(null);
    setSelectedNote(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    setImageFile(file);
  };

  const selectLibraryNote = (note) => {
    setSelectedNote(note);
    setPdfFile(null);
    setImageFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
    setPickerLibrary(null);
    setLibrarySearch("");
  };

  const removeChip = (kind) => {
    if (kind === "note") setSelectedNote(null);
    if (kind === "pdf") {
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
    if (kind === "image") {
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const openPicker = (library) => {
    setPlusOpen(false);
    setPickerLibrary(library);
    setLibrarySearch("");
  };

  const handleSummariseChip = () => {
    if (hasAttachment) {
      runAction(
        "summarise",
        "Please create a comprehensive study summary of the attached material."
      );
      return;
    }
    setQuestion("Summarise my lecture notes in detail.");
    setPlusOpen(true);
  };

  const handleQuizChip = () => {
    if (course || hasAttachment) {
      runAction(
        "quiz",
        "Please generate practice quiz questions from the selected course or attached material."
      );
      return;
    }
    setQuestion("Generate practice questions for this topic.");
  };

  const composer = (placement) => (
    <form className={`ai-compose ${placement}`} onSubmit={handleAsk}>
      <div className="ai-plus-wrap" ref={plusMenuRef}>
        <button
          type="button"
          className={`ai-plus-btn${plusOpen ? " open" : ""}`}
          aria-label="Add attachment"
          aria-expanded={plusOpen}
          disabled={loading || uploading}
          onClick={() => setPlusOpen((open) => !open)}
        >
          +
        </button>
        {plusOpen ? (
          <div className="ai-plus-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="ai-plus-item"
              onClick={() => {
                setPlusOpen(false);
                pdfInputRef.current?.click();
              }}
            >
              <span className="ai-plus-ico" style={{ background: "#dbeafe", color: "#2563eb" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V9h4.5L14 4.5Z" />
                </svg>
              </span>
              <span>
                <strong>Upload PDF or Document</strong>
                <span>Notes, study materials, etc.</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ai-plus-item"
              onClick={() => {
                setPlusOpen(false);
                imageInputRef.current?.click();
              }}
            >
              <span className="ai-plus-ico" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 8-4.8-6-3.7 4.8-2.2-2.6L5 16h15Z" />
                </svg>
              </span>
              <span>
                <strong>Upload Image</strong>
                <span>Diagrams, charts, etc.</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ai-plus-item"
              onClick={() => openPicker("personal")}
            >
              <span className="ai-plus-ico" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" />
                </svg>
              </span>
              <span>
                <strong>From My Uploads</strong>
                <span>Your personal files</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ai-plus-item"
              onClick={() => openPicker("official")}
            >
              <span className="ai-plus-ico" style={{ background: "#ffedd5", color: "#ea580c" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z" />
                </svg>
              </span>
              <span>
                <strong>From General Materials</strong>
                <span>Official AgriLearn resources</span>
              </span>
            </button>
            <button
              type="button"
              className="ai-plus-cancel"
              onClick={() => setPlusOpen(false)}
            >
              <span className="ai-plus-ico" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                ×
              </span>
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <textarea
        rows={1}
        placeholder="Ask anything about agriculture..."
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

      <button
        type="submit"
        className="ai-send-btn"
        disabled={loading || !question.trim()}
        aria-label="Send message"
      >
        <IconPlane />
      </button>
    </form>
  );

  const attachmentRow = (attachmentChips.length > 0 || uploading) && (
    <div className="ai-attach-row">
      {uploading ? <span className="ai-attach-status">Saving PDF…</span> : null}
      {attachmentChips.map((chip) => (
        <span key={chip.id} className="ai-attach-chip">
          <span>
            <strong>{chip.label}</strong>
            <em>{chip.meta}</em>
          </span>
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={() => removeChip(chip.kind)}
            disabled={loading || uploading}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <section className="page-hero ai-page ai-shell">
      <header className="ai-ref-top">
        <div className="ai-ref-brand">
          <span className="ai-spark">
            <IconSpark />
          </span>
          <div>
            <h1>AI Assistant</h1>
            <p>Ask. Learn. Grow.</p>
          </div>
        </div>
        <div className="ai-ref-actions">
          <button
            type="button"
            className="ai-ghost-btn"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
          >
            Chats
          </button>
          <button
            type="button"
            className="ai-ghost-btn"
            onClick={startNewChat}
            disabled={loading}
          >
            New chat
          </button>
        </div>
      </header>

      <div className="ai-body">
        <img className="ai-farm" src="/ai-farm.png" alt="" />

        {!conversationStarted && !loading ? (
          <div className="ai-welcome-wrap">
            <img className="ai-mascot" src="/ai-mascot.png" alt="" />
            <h2 className="ai-hello">Hello, Learner! 👋</h2>
            <p className="ai-hello-sub">
              Your AgriLearn AI assistant is here to help you summarize notes,
              answer questions and more.
            </p>
            <div className="ai-chip-row">
              <button type="button" className="ai-chip" onClick={handleSummariseChip}>
                Summarize this document
              </button>
              <button type="button" className="ai-chip" onClick={handleQuizChip}>
                Generate quiz questions
              </button>
              <button
                type="button"
                className="ai-chip"
                onClick={() =>
                  setQuestion("Explain this topic step by step with examples.")
                }
              >
                Explain this topic
              </button>
              <button
                type="button"
                className="ai-chip"
                onClick={() =>
                  setQuestion(
                    "Give me study tips for understanding this agricultural concept."
                  )
                }
              >
                Study tips
              </button>
            </div>
            <div className="ai-center-composer">
              {attachmentRow}
              {composer("center")}
            </div>
            <p className="ai-tagline">Learn smarter. Grow better.</p>
          </div>
        ) : (
          <>
            <div className="ai-chat-stage" ref={chatLogRef} aria-live="polite">
              <div className="ai-chat-log">
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
                {loading ? (
                  <article className="ai-row bot ai-loading-row">
                    <div className="ai-avatar" aria-hidden="true">
                      AI
                    </div>
                    <div className="ai-bubble bot ai-loading-bubble">
                      <span>Thinking</span>
                      <span className="ai-typing" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </article>
                ) : null}
              </div>
            </div>
            <div className="ai-composer-dock">
              {pendingQuizCourse ? (
                <p className="ai-quiz-hint">
                  Quiz generated for {pendingQuizCourse}.
                  <button
                    type="button"
                    disabled={markingQuiz || loading}
                    onClick={handleMarkQuizCompleted}
                  >
                    {markingQuiz ? "Saving…" : "Mark completed"}
                  </button>
                </p>
              ) : null}
              {attachmentRow}
              {composer("dock")}
            </div>
          </>
        )}
      </div>

      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        disabled={loading || uploading}
        onChange={handlePdfChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        disabled={loading || uploading}
        onChange={handleImageChange}
      />

      {historyOpen ? (
        <>
          <button
            type="button"
            className="ai-history-backdrop"
            aria-label="Close chat history"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="ai-history-panel" aria-label="Conversation history">
            <div className="ai-history-head">
              <h2>Chats · {level} Level</h2>
              <button
                type="button"
                className="ai-ghost-btn"
                onClick={() => setHistoryOpen(false)}
              >
                Close
              </button>
            </div>
            <label className="sr-only" htmlFor="ai-history-search">
              Search conversations
            </label>
            <input
              id="ai-history-search"
              type="search"
              className="ai-history-search agri-search"
              placeholder="Search chats…"
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
                    : "Your chats will appear here."}
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
        </>
      ) : null}

      {pickerLibrary ? (
        <div
          className="ai-picker-backdrop"
          role="presentation"
          onClick={() => setPickerLibrary(null)}
        >
          <div
            className="ai-picker"
            role="dialog"
            aria-modal="true"
            aria-label={
              pickerLibrary === "personal"
                ? "My Personal Uploads"
                : "General Materials"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ai-picker-head">
              <div>
                <h2>
                  {pickerLibrary === "personal"
                    ? "My Personal Uploads"
                    : "General Materials"}
                </h2>
                <p>
                  {pickerLibrary === "personal"
                    ? "Private files uploaded by you."
                    : "Official AgriLearn materials for your level."}
                </p>
              </div>
              <button
                type="button"
                className="ai-picker-close"
                onClick={() => setPickerLibrary(null)}
              >
                Close
              </button>
            </header>
            <label className="sr-only" htmlFor="ai-picker-course">
              Course for materials
            </label>
            <select
              id="ai-picker-course"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              disabled={loading || uploading}
            >
              <option value="">Select a course</option>
              {courses.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} — {item.title}
                </option>
              ))}
            </select>
            {!course ? (
              <p className="ai-picker-empty">
                Choose a course to browse{" "}
                {pickerLibrary === "personal"
                  ? "your personal uploads"
                  : "official materials"}
                .
              </p>
            ) : (
              <>
                <input
                  type="search"
                  className="ai-picker-search agri-search"
                  placeholder="Search titles…"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  disabled={libraryLoading}
                />
                {libraryError ? (
                  <p className="ai-picker-error">{libraryError}</p>
                ) : null}
                <div className="ai-picker-list" role="list">
                  {libraryLoading ? (
                    <p className="ai-picker-empty">Loading…</p>
                  ) : filteredLibrary.length === 0 ? (
                    <p className="ai-picker-empty">
                      {librarySearch.trim()
                        ? "No files match your search."
                        : pickerLibrary === "personal"
                          ? "No personal uploads for this course yet."
                          : "No official materials for this course yet."}
                    </p>
                  ) : (
                    filteredLibrary.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        role="listitem"
                        className="ai-picker-item"
                        onClick={() => selectLibraryNote(note)}
                        disabled={loading || uploading}
                      >
                        <strong>{note.title}</strong>
                        <span>
                          {note.originalName}
                          {note.size ? ` · ${formatBytes(note.size)}` : ""}
                          {note.createdAt
                            ? ` · ${formatNoteDate(note.createdAt)}`
                            : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AIAssistant;
