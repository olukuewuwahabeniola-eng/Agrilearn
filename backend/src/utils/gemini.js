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
    generationConfig: {
      // Allow thorough academic answers without forcing every reply to max length.
      maxOutputTokens: 8192,
      temperature: 0.65,
    },
    systemInstruction:
      "You are the AgriLearn academic assistant for university agriculture students. " +
      "Be accurate, supportive, and educational. Match depth to the question: " +
      "simple factual questions may be concise; complex academic topics need detailed explanations. " +
      "Do not give shallow one-paragraph answers for course concepts, processes, or exam-style topics. " +
      "When explaining, cover: what the concept is, why it matters, key terms, relationships, " +
      "step-by-step processes, agricultural examples, and practical applications where useful. " +
      "Use clear Markdown: headings, short paragraphs, bullet/numbered lists, bold for key terms, " +
      "and tables when comparing ideas. End with a short Key takeaways section when helpful. " +
      "For document summaries: produce comprehensive structured notes that cover major sections, " +
      "definitions, facts, examples, and important details from the material. " +
      "Do not collapse a full lecture into a few sentences. " +
      "Clearly separate content taken from the attached document from any extra explanation you add. " +
      "Never invent facts, citations, or AgriLearn files that were not provided. " +
      "If a PDF/image or course context is provided, ground answers in that material first. " +
      "For follow-ups, use conversation history, build on earlier explanations, and avoid unnecessary repetition. " +
      "For quizzes, use separate Questions and Answer Key sections.",
  });
}

/**
 * Generate a text reply. Optional PDF/image as base64 inline data (free-tier multimodal).
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
