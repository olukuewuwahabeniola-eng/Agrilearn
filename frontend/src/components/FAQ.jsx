import { useState } from "react";
import "./FAQ.css";

const FAQS = [
  {
    question: "Who is AgriLearn for?",
    answer:
      "AgriLearn is for Faculty of Agriculture students who want organised lecture notes, practice questions, and a simple way to track their learning progress.",
  },
  {
    question: "Which academic levels are supported?",
    answer:
      "The platform is designed to support 100, 200, 300 and 500 level students with materials organised by level.",
  },
  {
    question: "Is AgriLearn free to use?",
    answer:
      "Sign up and log in will be available when accounts are ready. For now, you can explore the homepage and learn what AgriLearn offers.",
  },
  {
    question: "Can I practice with quizzes?",
    answer:
      "Yes. Practice quizzes are one of the core features planned so you can revise and check your understanding.",
  },
  {
    question: "How do I get started?",
    answer:
      "Browse the sections on this page to learn more. When registration opens, use the Sign Up button to create your account.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (index) => {
    setOpenIndex((current) => (current === index ? -1 : index));
  };

  return (
    <section id="faqs" className="faqs section">
      <div className="container">
        <h2 className="section-title">FAQs</h2>
        <p className="section-subtitle">
          Quick answers about AgriLearn and how it helps you study.
        </p>

        <div className="faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={`faq-item${isOpen ? " open" : ""}`}
              >
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={isOpen}
                  onClick={() => toggle(index)}
                >
                  <span>{faq.question}</span>
                  <span className="faq-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FAQ;
