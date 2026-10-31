import "./Hero.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80";

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-wave" />
      </div>

      <div className="container hero-grid">
        <div className="hero-content">
          <span className="hero-badge">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3c2 4 2 7 0 10-2-3-2-6 0-10z"
                fill="#166534"
              />
              <path
                d="M7 8c3 2 5 2 8 0-3 4-5 6-8 8 0-3 0-5 0-8z"
                fill="#22c55e"
              />
              <path
                d="M12 13v8"
                stroke="#166534"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Welcome to AgriLearn
          </span>

          <h1 className="hero-title">
            Hello, Future <span className="accent">Agripreneur!</span>
          </h1>

          <p className="hero-text">
            Your go-to platform for lecture notes, practice questions, and
            tracking your progress as you grow into a skilled agripreneur.
          </p>

          <div className="hero-ctas">
            <a href="#features" className="btn btn-primary">
              Get Started <span aria-hidden="true">→</span>
            </a>
            <a href="#about" className="btn btn-outline">
              Learn More
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <p className="hero-script">Study Smarter... Grow Greater...</p>
          <div className="hero-image-wrap">
            <img
              src={HERO_IMAGE}
              alt="Students collaborating outdoors with a laptop"
              width="800"
              height="600"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
