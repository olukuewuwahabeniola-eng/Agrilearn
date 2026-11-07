import { Link } from "react-router-dom";
import "./Hero.css";

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
            AgriLearn is the learning platform for Faculty of Agriculture
            students. Find lecture notes, past questions, practice quizzes, and
            an AI study assistant — organised by your academic level.
          </p>

          <div className="hero-ctas">
            <Link to="/signup" className="btn btn-primary">
              Create your account <span aria-hidden="true">→</span>
            </Link>
            <a href="#features" className="btn btn-outline">
              Explore features
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <p className="hero-script">Study Smarter... Grow Greater...</p>
          <div className="hero-image-wrap">
            <img
              src="/home/hero-students.jpg"
              alt="Students studying together with laptops"
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
