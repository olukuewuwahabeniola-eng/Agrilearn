function Svg({ children, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconUsers() {
  return (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9.5" cy="7.5" r="3.4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
      <path d="M16 3.13a3.5 3.5 0 0 1 0 6.74" strokeLinecap="round" />
    </Svg>
  );
}

export function IconUpload() {
  return (
    <Svg>
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="M8 9l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </Svg>
  );
}

export function IconFolder() {
  return (
    <Svg>
      <path
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6H9l2 2h7.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-10z"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconFile() {
  return (
    <Svg>
      <path d="M7 4h7l5 5v11H7z" strokeLinejoin="round" />
      <path d="M14 4v5h5" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconSearch() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconClipboard() {
  return (
    <Svg>
      <rect x="6" y="5" width="12" height="15" rx="2" />
      <path d="M9 5V4h6v1" strokeLinecap="round" />
      <path d="M9 11h6M9 15h4" strokeLinecap="round" />
    </Svg>
  );
}

export function IconActivity() {
  return (
    <Svg>
      <path d="M4 12h4l2.5-6 3 12 2.5-6H20" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconShield() {
  return (
    <Svg>
      <path d="M12 3.5 5 6.2v5.1c0 4.1 2.8 7.8 7 8.7 4.2-.9 7-4.6 7-8.7V6.2L12 3.5z" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconWarning() {
  return (
    <Svg>
      <path d="M12 4 21 19H3L12 4z" strokeLinejoin="round" />
      <path d="M12 10v5" strokeLinecap="round" />
      <path d="M12 17.2h.01" strokeLinecap="round" />
    </Svg>
  );
}
