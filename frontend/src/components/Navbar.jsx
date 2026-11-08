import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LOGIN_SELECTION_PATH } from "../utils/authNavigation";
import "./Navbar.css";

const LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#aim", label: "Our Aim" },
  { href: "#levels", label: "Levels" },
  { href: "#faqs", label: "FAQs" },
  { href: "#contact", label: "Contact" },
];

function Logo() {
  return (
    <a href="#home" className="logo" aria-label="AgriLearn home">
      <img src="/logo.png" alt="" className="logo-icon" />
      <span className="logo-text">
        <span className="logo-name">AgriLearn</span>
        <span className="logo-tagline">Learn • Practice • Excel</span>
      </span>
    </a>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("#home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = LINKS.map((l) => l.href.slice(1));

    const onScroll = () => {
      const offset = window.scrollY + 100;
      let current = "#home";

      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= offset) {
          current = `#${id}`;
        }
      }
      setActive(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = () => setMenuOpen(false);

  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="container navbar-inner">
        <Logo />

        <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={active === link.href ? "active" : ""}
              onClick={handleNavClick}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <Link to={LOGIN_SELECTION_PATH} className="btn btn-outline">
            Log In
          </Link>
          <Link to="/signup" className="btn btn-primary">
            Sign Up
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
