const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const { ALLOWED_LEVELS } = require("../models/Student");
const {
  recordStudentLogin,
  recordStudentRegistration,
  touchStudentLastActive,
} = require("../utils/activityTracker");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(student) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing from backend/.env");
  }

  return jwt.sign(
    {
      id: student._id,
      email: student.email,
      matricNumber: student.matricNumber,
      level: student.level,
    },
    secret,
    { expiresIn: "7d" }
  );
}

function validateSignupBody(body) {
  const errors = {};
  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const matricNumber = String(body.matricNumber || "").trim();
  const level = String(body.level || "").trim();
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");

  if (!fullName) errors.fullName = "Please enter your full name.";
  else if (fullName.length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  if (!email) errors.email = "Please enter your student email.";
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!matricNumber) {
    errors.matricNumber = "Please enter your matriculation number.";
  } else if (matricNumber.length < 4) {
    errors.matricNumber = "Matriculation number looks too short.";
  }

  if (!level) errors.level = "Please select your academic level.";
  else if (!ALLOWED_LEVELS.includes(level)) {
    errors.level = "Choose 100, 200, 300, or 500 level.";
  }

  if (!password) errors.password = "Please create a password.";
  else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return {
    errors,
    data: { fullName, email, matricNumber, level, password },
  };
}

async function signup(req, res) {
  try {
    const { errors, data } = validateSignupBody(req.body || {});

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    const existingEmail = await Student.findOne({ email: data.email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }

    const existingMatric = await Student.findOne({
      matricNumber: data.matricNumber,
    });
    if (existingMatric) {
      return res.status(409).json({
        success: false,
        message: "An account with this matriculation number already exists.",
        errors: {
          matricNumber: "This matriculation number is already registered.",
        },
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const student = await Student.create({
      fullName: data.fullName,
      email: data.email,
      matricNumber: data.matricNumber,
      level: data.level,
      password: passwordHash,
    });

    await recordStudentRegistration(student);

    return res.status(201).json({
      success: true,
      message: "Account created successfully. You can now log in.",
      student: student.toSafeObject(),
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `That ${field} is already registered.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not create your account. Please try again.",
    });
  }
}

async function login(req, res) {
  try {
    const identifier = String(req.body?.identifier || "").trim();
    const password = String(req.body?.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/matriculation number and password are required.",
        errors: {
          ...(identifier
            ? {}
            : {
                identifier:
                  "Enter your student email or matriculation number.",
              }),
          ...(password ? {} : { password: "Please enter your password." }),
        },
      });
    }

    const query = EMAIL_PATTERN.test(identifier.toLowerCase())
      ? { email: identifier.toLowerCase() }
      : { matricNumber: identifier };

    const student = await Student.findOne(query).select("+password");

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Invalid login details. Please try again.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, student.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid login details. Please try again.",
      });
    }

    const token = createToken(student);

    await recordStudentLogin(student);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      token,
      student: student.toSafeObject(),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not log you in. Please try again.",
    });
  }
}

async function me(req, res) {
  await touchStudentLastActive(req.student._id);
  return res.status(200).json({
    success: true,
    student: req.student.toSafeObject(),
  });
}

module.exports = {
  signup,
  login,
  me,
};
