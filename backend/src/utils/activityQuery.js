/**
 * Shared query parsing for admin activity endpoints.
 */

const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("../models/Student");
const Student = require("../models/Student");
const {
  applyAdminLevelFilter,
  sendAdminAccessError,
} = require("./adminAccess");

function parseActivityQuery(req) {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25)
  );
  const skip = (page - 1) * limit;

  const sortField = String(req.query.sortBy || "createdAt");
  const sortDir = String(req.query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;
  const allowedSort = ["createdAt", "level", "type", "category"];
  const sort = {
    [allowedSort.includes(sortField) ? sortField : "createdAt"]: sortDir,
  };

  const q = String(req.query.q || "").trim();
  const studentId = String(req.query.studentId || "").trim();
  const level = String(req.query.level || "").trim();
  const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
  const category = String(req.query.category || "").trim();
  const type = String(req.query.type || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();

  const filter = {};

  if (studentId) filter.student = studentId;
  // Never trust client level alone — enforce assigned level for Level Admins.
  if (req.admin) {
    applyAdminLevelFilter(req.admin, filter, level);
  } else if (level && ALLOWED_LEVELS.includes(level)) {
    filter.level = level;
  }
  if (courseCode) filter.courseCode = courseCode;
  if (category) filter.category = category;
  if (type) filter.type = type;

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) filter.createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) filter.createdAt.$lte = toDate;
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    filter.$or = [
      { title: regex },
      { courseCode: regex },
      { courseTitle: regex },
      { type: regex },
    ];
  }

  return { page, limit, skip, sort, filter, q };
}

/**
 * Restrict activity queries to students matching name, email, or matric.
 */
async function applyStudentQueryFilter(filter, req) {
  const studentQ = String(req.query.studentQ || "").trim();
  if (!studentQ) return filter;

  const safe = studentQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(safe, "i");
  const students = await Student.find({
    $or: [{ fullName: regex }, { email: regex }, { matricNumber: regex }],
  })
    .select("_id")
    .limit(300);

  const ids = students.map((s) => s._id);
  if (!ids.length) {
    filter.student = new mongoose.Types.ObjectId("000000000000000000000000");
    return filter;
  }
  filter.student = ids.length === 1 ? ids[0] : { $in: ids };
  return filter;
}

async function parseActivityQueryAsync(req) {
  const parsed = parseActivityQuery(req);
  await applyStudentQueryFilter(parsed.filter, req);
  return parsed;
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = {
  parseActivityQuery,
  parseActivityQueryAsync,
  applyStudentQueryFilter,
  paginationMeta,
  sendAdminAccessError,
};
