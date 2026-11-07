import "./Footer.css";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <img src="/logo.png" alt="" />
          AgriLearn
        </div>

        <p className="footer-copy">
          © {year} AgriLearn. A learning home for agriculture students. Learn •
          Practice • Excel
        </p>

        <nav className="footer-links" aria-label="Footer">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#levels">Levels</a>
          <a href="#faqs">FAQs</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
