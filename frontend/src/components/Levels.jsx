import "./Levels.css";

const LEVELS = [
  {
    level: "100 Level",
    label: "Foundation",
    text: "Build strong basics for your agriculture journey.",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80",
    alt: "Green crop field under open sky",
  },
  {
    level: "200 Level",
    label: "Growing",
    text: "Deepen course understanding with focused materials.",
    image:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80",
    alt: "Farmer working among healthy crops",
  },
  {
    level: "300 Level",
    label: "Advancing",
    text: "Practice with more advanced notes and quizzes.",
    image:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=800&q=80",
    alt: "Fresh vegetables harvested from the farm",
  },
  {
    level: "500 Level",
    label: "Excelling",
    text: "Prepare for final-year excellence and beyond.",
    image:
      "https://images.unsplash.com/photo-1500937386664-56d1dfef3033?auto=format&fit=crop&w=800&q=80",
    alt: "Sunrise over agricultural farmland",
  },
];

function Levels() {
  return (
    <section id="levels" className="levels section">
      <div className="container">
        <h2 className="section-title reveal">Academic Levels</h2>
        <p className="section-subtitle reveal">
          Explore learning resources organised for 100, 200, 300 and 500 level
          students.
        </p>

        <div className="levels-grid">
          {LEVELS.map((item) => (
            <article key={item.level} className="level-card reveal">
              <img
                src={item.image}
                alt={item.alt}
                width="400"
                height="240"
                loading="lazy"
              />
              <div className="level-overlay">
                <span className="level-badge">{item.label}</span>
                <h3>{item.level}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Levels;
