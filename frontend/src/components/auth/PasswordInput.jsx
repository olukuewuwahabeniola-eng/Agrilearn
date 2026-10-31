import { useState } from "react";

function EyeIcon({ crossed = false }) {
  if (crossed) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path
          d="M10.6 10.6a2 2 0 002.8 2.8"
          strokeLinecap="round"
        />
        <path
          d="M9.9 5.1A10.5 10.5 0 0121 12c-.7 1.1-1.6 2.1-2.6 2.9M6.1 6.1C4.7 7.2 3.6 8.5 3 12c1.8 4.5 5.7 7 9 7 1.4 0 2.8-.3 4.1-.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  className = "",
  disabled = false,
  "aria-invalid": ariaInvalid,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={className}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        {...inputProps}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        disabled={disabled}
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  );
}

export default PasswordInput;
