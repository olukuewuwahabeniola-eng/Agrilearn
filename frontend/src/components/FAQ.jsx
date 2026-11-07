import { useState } from "react";
import "./FAQ.css";

const FAQS = [
  {
    question: "Who is AgriLearn for?",
    answer:
      "AgriLearn is for Faculty of Agriculture students who want lecture notes, past questions, practice quizzes, and a simple way to follow their learning progress.",
  },
  {
    question: "Which academic levels are supported?",
    answer:
      "AgriLearn supports 100, 200, 300 and 500 Level students. After you sign up, you will see the courses and materials for your level.",
  },
  {
    question: "Is AgriLearn free to use?",
    answer:
      "Yes. Create a free student account to open your dashboard, course materials, quizzes, and the AI assistant.",
  },
  {
    question: "Can I practise with quizzes?",
    answer:
      "Yes. You can take practice quizzes for your courses and generate revision quizzes with the AgriLearn AI assistant.",
  },
  {
    question: "How do I get started?",
    answer:
      "Select Sign Up, create your student account, then log in. Your level dashboard will be ready with your courses and study tools.",
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
        <h2 className="section-title">Frequently asked questions</h2>
        <p className="section-subtitle">
          A few quick answers about studying with AgriLearn.
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
