import { Link } from "react-router-dom";
import "./FooterCTA.css";

function FooterCTA() {
  return (
    <section className="footer-cta">
      <div className="footer-cta-bg" aria-hidden="true">
        <img
          src="/home/cta-field.jpg"
          alt=""
          width="1600"
          height="600"
          loading="lazy"
        />
      </div>

      <div className="container footer-cta-content reveal">
        <blockquote>
          “Together, let’s build a smarter, brighter future in{" "}
          <strong>Agriculture</strong>.”
        </blockquote>
        <p className="footer-cta-lead">
          Create your free student account and start learning with AgriLearn.
        </p>

        <div className="footer-cta-actions">
          <Link to="/signup" className="btn btn-white">
            Sign Up Free <span aria-hidden="true">→</span>
          </Link>
          <Link to="/login" className="btn btn-ghost-light">
            Log In
          </Link>
        </div>
      </div>
    </section>
  );
}

export default FooterCTA;
