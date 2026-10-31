import "./Features.css";

const FEATURES = [
  {
    title: "Organized Course Notes",
    text: "Access clear lecture notes and PDFs organised by academic level.",
    tone: "blue",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5a2 2 0 012-2h7l5 5v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
        <path d="M13 3v5h5M8 13h8M8 17h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Practice Quizzes",
    text: "Test your knowledge with practice questions designed for revision.",
    tone: "green",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Track Your Progress",
    text: "See what you have completed and stay motivated through the semester.",
    tone: "teal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V5M4 19h16" strokeLinecap="round" />
        <path d="M8 15v-3M12 15V8M16 15v-6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "All Levels Supported",
    text: "Resources for 100, 200, 300 and 500 level agriculture courses.",
    tone: "yellow",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 9l10-5 10 5-10 5L2 9z" strokeLinejoin="round" />
        <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

function Features() {
  return (
    <section id="features" className="features section">
      <div className="container">
        <h2 className="section-title reveal">What You&apos;ll Get</h2>
        <p className="section-subtitle reveal">
          Simple tools to help you study better and grow as an agripreneur.
        </p>

        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={`feature-card ${feature.tone} reveal`}
            >
              <div className="feature-icon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
