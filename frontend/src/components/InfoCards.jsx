import "./InfoCards.css";

const SPROUT_IMAGE =
  "https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?auto=format&fit=crop&w=400&q=80";

const OBJECTIVES = [
  "Make lecture notes easily accessible.",
  "Provide practice questions and quizzes.",
  "Track student progress.",
  "Support academic success in the Faculty of Agriculture.",
];

function CheckIcon() {
  return (
    <span className="check" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function InfoCards() {
  return (
    <section className="info-cards section" id="about">
      <div className="container info-grid">
        <article className="info-card info-card-about reveal">
          <div>
            <div className="info-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 9l10-5 10 5-10 5L2 9z" strokeLinejoin="round" />
                <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3>About AgriLearn</h3>
            <p>
              AgriLearn is a learning platform built for Faculty of Agriculture
              students. Find course materials, practice with quizzes, and stay
              organised as you move through your academic journey.
            </p>
            <a href="#features" className="info-link">
              Learn More <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="about-image">
            <img
              src={SPROUT_IMAGE}
              alt="Young plant sprout growing in soil"
              width="110"
              height="110"
              loading="lazy"
            />
          </div>
        </article>

        <article className="info-card reveal" id="aim">
          <div className="info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h3>Our Aim</h3>
          <p>
            To help agriculture students learn with clarity and confidence —
            by putting notes, practice, and progress tracking in one simple
            place.
          </p>
        </article>

        <article className="info-card reveal">
          <div className="info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
              <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h3>Our Objectives</h3>
          <ul className="objectives-list">
            {OBJECTIVES.map((item) => (
              <li key={item}>
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

export default InfoCards;
