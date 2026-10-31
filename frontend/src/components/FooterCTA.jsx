import { Link } from "react-router-dom";
import "./FooterCTA.css";

const FIELD_IMAGE =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1600&q=80";

function FooterCTA() {
  return (
    <section className="footer-cta">
      <div className="footer-cta-bg" aria-hidden="true">
        <img
          src={FIELD_IMAGE}
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
