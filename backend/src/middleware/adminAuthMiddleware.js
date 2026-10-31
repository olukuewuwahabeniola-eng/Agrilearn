const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { getAdminTokenFromRequest } = require("../utils/adminSession");
const { isSuperAdmin } = require("../utils/adminAccess");

/**
 * Protect admin routes.
 * Accepts HTTP-only cookie or Authorization: Bearer <token>.
 * Re-checks Admin document in MongoDB (never trust the client alone).
 */
async function protectAdmin(req, res, next) {
  try {
    const token = getAdminTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please log in as an administrator to continue.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured.",
      });
    }

    const decoded = jwt.verify(token, secret);

    // Legacy tokens used role:"admin"; newer tokens keep typ:"admin".
    const isAdminToken =
      decoded.typ === "admin" ||
      decoded.role === "admin" ||
      decoded.role === "super_admin" ||
      decoded.role === "level_admin";

    if (!isAdminToken) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required.",
      });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Administrator account not found. Please log in again.",
      });
    }

    // Soft-migrate legacy role without changing credentials.
    if (admin.role === "admin") {
      admin.role = "super_admin";
      admin.assignedLevel = null;
      await Admin.updateOne(
        { _id: admin._id },
        { $set: { role: "super_admin", assignedLevel: null } }
      );
    }

    if (admin.isActive === false) {
      return res.status(403).json({
        success: false,
        message:
          "This administrator account has been deactivated. Contact the Super Admin.",
      });
    }

    if (admin.invitePending) {
      return res.status(403).json({
        success: false,
        message:
          "Complete invitation password setup before accessing the Admin Console.",
      });
    }

    if (admin.role === "level_admin" && !admin.assignedLevel) {
      return res.status(403).json({
        success: false,
        message: "This Level Admin account has no assigned academic level.",
      });
    }

    req.admin = admin;
    req.adminIsSuper = isSuperAdmin(admin);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your admin session is invalid or expired. Please log in again.",
    });
  }
}

module.exports = {
  protectAdmin,
};
