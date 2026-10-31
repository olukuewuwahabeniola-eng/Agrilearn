const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Free-tier model for new Google AI Studio keys.
 * gemini-2.5-flash-lite returns 404 for new users; use 3.5 Flash-Lite instead.
 * Override with GEMINI_MODEL in backend/.env if needed — free tier only.
 */
const DEFAULT_FREE_MODEL = "gemini-3.5-flash-lite";

function getGeminiModelId() {
  const fromEnv = String(process.env.GEMINI_MODEL || "").trim();
  return fromEnv || DEFAULT_FREE_MODEL;
}

function isGeminiConfigured() {
  return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
}

function sanitizeGeminiMessage(message) {
  return String(message || "")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED_KEY]")
    .replace(/key=[^\s&]+/gi, "key=[REDACTED]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
}

function getGenerativeModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error(
      "GEMINI_API_KEY is missing. Add your free-tier Google AI Studio key to backend/.env."
    );
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: getGeminiModelId(),
    systemInstruction:
      "You are the AgriLearn academic assistant for university agriculture students. " +
      "Explain clearly for the student's academic level. Be accurate, supportive, and concise. " +
      "Format every reply in clean Markdown: use headings, short paragraphs, bullet or numbered lists, " +
      "bold for key terms, and tables or fenced code blocks when helpful. " +
      "For summaries, use clear section headings. For quizzes, separate Questions and Answer Key sections. " +
      "If a PDF or course context is provided, ground answers in that material. " +
      "If information is missing, say so and give the best general academic guidance. " +
      "Do not invent AgriLearn-uploaded files that were not provided.",
  });
}

/**
 * Generate a text reply. Optional PDF as base64 inline data (free-tier document understanding).
 */
async function generateAgriLearnReply({ prompt, pdfBuffer, pdfMimeType }) {
  const model = getGenerativeModel();
  const parts = [{ text: prompt }];

  if (pdfBuffer && pdfBuffer.length > 0) {
    parts.push({
      inlineData: {
        mimeType: pdfMimeType || "application/pdf",
        data: pdfBuffer.toString("base64"),
      },
    });
  }

  const result = await model.generateContent(parts);
  let text = "";
  try {
    text = result?.response?.text?.() || "";
  } catch (readError) {
    const safe = sanitizeGeminiMessage(readError.message);
    const error = new Error(
      `Gemini returned a blocked or unreadable response (${safe}). Try rephrasing your question.`
    );
    error.code = "GEMINI_BLOCKED";
    throw error;
  }

  if (!String(text).trim()) {
    const error = new Error("The AI returned an empty response. Please try again.");
    error.code = "GEMINI_EMPTY";
    throw error;
  }

  return String(text).trim();
}

module.exports = {
  DEFAULT_FREE_MODEL,
  getGeminiModelId,
  isGeminiConfigured,
  sanitizeGeminiMessage,
  generateAgriLearnReply,
};
