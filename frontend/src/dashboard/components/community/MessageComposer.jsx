import { useEffect, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker";

function MessageComposer({
  disabled = false,
  sending = false,
  onSend,
  onAttach,
  onTyping,
  placeholder = "Type a message...",
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const imageRef = useRef(null);
  const pdfRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const wrap = wrapRef.current;
    if (!viewport || !wrap) return undefined;

    const syncKeyboard = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      wrap.style.setProperty("--keyboard-inset", `${inset}px`);
    };

    syncKeyboard();
    viewport.addEventListener("resize", syncKeyboard);
    viewport.addEventListener("scroll", syncKeyboard);
    return () => {
      viewport.removeEventListener("resize", syncKeyboard);
      viewport.removeEventListener("scroll", syncKeyboard);
      wrap.style.removeProperty("--keyboard-inset");
    };
  }, []);

  const submit = async () => {
    const value = text.trim();
    if (!value || disabled || sending) return;
    await onSend(value);
    setText("");
    setEmojiOpen(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    onTyping?.(false);
  };

  return (
    <div className="community-composer-wrap" ref={wrapRef}>
      {emojiOpen ? (
        <EmojiPicker
          onSelect={(emoji) => {
            setText((current) => `${current}${emoji}`);
            inputRef.current?.focus();
          }}
          onClose={() => setEmojiOpen(false)}
        />
      ) : null}

      <form
        className="community-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="community-composer-pill">
          <button
            type="button"
            className="community-icon-btn"
            aria-label="Insert emoji"
            disabled={disabled}
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" strokeLinecap="round" />
              <circle cx="9" cy="10" r="0.8" fill="currentColor" />
              <circle cx="15" cy="10" r="0.8" fill="currentColor" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => {
              const value = event.target.value;
              setText(value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
              onTyping?.(Boolean(value.trim()));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />

          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAttach(file, text);
            }}
          />
          <input
            ref={imageRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAttach(file, text);
            }}
          />
          <input
            ref={pdfRef}
            type="file"
            hidden
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAttach(file, text);
            }}
          />

          <button
            type="button"
            className="community-icon-btn"
            aria-label="Attach a file"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 8v8a4 4 0 008 0V7a3 3 0 00-6 0v8a2 2 0 004 0V9" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="community-icon-btn"
            aria-label="Share an image"
            disabled={disabled}
            onClick={() => imageRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.4" />
              <path d="M4 16l5-4 4 3 3-2 4 3" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="community-icon-btn"
            aria-label="Share a PDF"
            disabled={disabled}
            onClick={() => pdfRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 3h8l4 4v14H7V3z" />
              <path d="M15 3v4h4M9 13h6M9 17h4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="submit"
          className="community-send-btn"
          aria-label="Send message"
          disabled={disabled || sending || !text.trim()}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 11.5L20 4l-6.2 16.2-2.6-6.1L4 11.5z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default MessageComposer;
