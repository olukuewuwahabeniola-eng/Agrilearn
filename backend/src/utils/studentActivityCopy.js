/**
 * Human-readable activity lines for the student dashboard.
 */
function formatStudentActivity(activity) {
  if (!activity) return "Activity recorded.";

  const course = activity.courseCode
    ? String(activity.courseCode).toUpperCase()
    : "";
  const meta = activity.metadata || {};
  const topic =
    meta.topicTitle ||
    meta.fileName ||
    meta.quizTitle ||
    activity.title ||
    "";

  switch (activity.type) {
    case "login":
      return "Logged into AgriLearn.";
    case "registration":
      return "Joined AgriLearn.";
    case "course_access":
      return course ? `Opened course ${course}.` : "Opened a course.";
    case "material_view":
      if (activity.relatedModel === "PastQuestion") {
        return course
          ? `Viewed past questions for ${course}.`
          : "Viewed past questions.";
      }
      return course
        ? `Viewed lecture notes in ${course}.`
        : "Viewed lecture notes.";
    case "material_download":
      if (activity.relatedModel === "PastQuestion") {
        return course
          ? `Downloaded past questions for ${course}.`
          : "Downloaded past questions.";
      }
      return course
        ? `Downloaded lecture notes in ${course}.`
        : "Downloaded lecture notes.";
    case "personal_upload":
      return course
        ? `Uploaded personal materials for ${course}.`
        : "Uploaded personal learning materials.";
    case "ai_question":
      return course
        ? `Asked the AI Assistant about ${course}.`
        : "Used the AI Assistant.";
    case "ai_summarise":
      return course
        ? `Asked AI to summarise materials in ${course}.`
        : "Asked AI to summarise materials.";
    case "ai_quiz":
      return course
        ? `Generated a practice quiz in ${course}.`
        : "Generated a practice quiz.";
    case "quiz_completed":
      return course
        ? `Completed a quiz in ${course}.`
        : "Completed a quiz.";
    case "quiz_attempt":
      return course
        ? `Started a quiz in ${course}.`
        : "Started a quiz.";
    case "learning_completed":
      if (topic && course) {
        return `Marked “${String(topic).slice(0, 80)}” as completed in ${course}.`;
      }
      if (topic) return `Marked “${String(topic).slice(0, 80)}” as completed.`;
      return course
        ? `Marked a topic as completed in ${course}.`
        : "Marked a topic as completed.";
    default:
      return activity.title || "Activity recorded.";
  }
}

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

module.exports = {
  formatStudentActivity,
  formatRelativeTime,
};
