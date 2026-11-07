import "./Levels.css";

const LEVELS = [
  {
    level: "100 Level",
    label: "Foundation",
    text: "Start strong with the core courses that shape your agriculture journey.",
    image: "/home/level-100.jpg",
    alt: "Young maize plants growing in a field",
  },
  {
    level: "200 Level",
    label: "Growing",
    text: "Build on the basics with focused notes and practice for your courses.",
    image: "/home/level-200.jpg",
    alt: "Farmers working a rice field with a tractor",
  },
  {
    level: "300 Level",
    label: "Advancing",
    text: "Go deeper with course materials, quizzes, and past questions.",
    image: "/home/level-300.jpg",
    alt: "Fresh harvested vegetables at a market",
  },
  {
    level: "500 Level",
    label: "Excelling",
    text: "Prepare for final-year courses with organised materials and revision support.",
    image: "/home/level-500.jpg",
    alt: "Established crop rows stretching across farmland",
  },
];

function Levels() {
  return (
    <section id="levels" className="levels section">
      <div className="container">
        <h2 className="section-title reveal">Academic levels</h2>
        <p className="section-subtitle reveal">
          Your dashboard opens the courses and materials for your level — 100,
          200, 300 or 500.
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
