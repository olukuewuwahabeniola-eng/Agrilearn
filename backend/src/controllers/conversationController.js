const mongoose = require("mongoose");
const AiConversation = require("../models/AiConversation");

/**
 * Ensure the conversation belongs to the authenticated student.
 */
async function findOwnedConversation(conversationId, studentId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }
  return AiConversation.findOne({
    _id: conversationId,
    student: studentId,
  });
}

/**
 * GET /api/ai/conversations
 * List this student's conversations (newest first). Optional ?q= search.
 */
async function listConversations(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const filter = { student: req.student._id };

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { title: regex },
        { courseCode: regex },
        { courseTitle: regex },
        { "messages.text": regex },
      ];
    }

    const conversations = await AiConversation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("title level courseCode courseTitle updatedAt createdAt messages");

    return res.status(200).json({
      success: true,
      count: conversations.length,
      conversations: conversations.map((c) => c.toListItem()),
    });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load conversation history.",
    });
  }
}

/**
 * GET /api/ai/conversations/:id
 * Full conversation for this student only.
 */
async function getConversation(req, res) {
  try {
    const conversation = await findOwnedConversation(
      req.params.id,
      req.student._id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      conversation: conversation.toDetailObject(),
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not open that conversation.",
    });
  }
}

/**
 * DELETE /api/ai/conversations/:id
 * Delete only if owned by the authenticated student.
 */
async function deleteConversation(req, res) {
  try {
    const conversation = await findOwnedConversation(
      req.params.id,
      req.student._id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    await conversation.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Conversation deleted.",
      id: req.params.id,
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete that conversation.",
    });
  }
}

module.exports = {
  listConversations,
  getConversation,
  deleteConversation,
  findOwnedConversation,
};
