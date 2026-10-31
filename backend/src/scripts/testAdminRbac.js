/**
 * Non-destructive RBAC checks for Super Admin / Level Admin.
 * Does not delete students, notes, or other platform data.
 * Creates a temporary Level Admin, verifies permissions, then removes it.
 *
 * Usage (from backend/): node src/scripts/testAdminRbac.js
 */
require("dotenv").config();

const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const { normalizeMongoUri } = require("../config/db");
const {
  resolveScopedLevel,
  applyAdminLevelFilter,
  isSuperAdmin,
} = require("../utils/adminAccess");

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}`;
const TEST_EMAIL = `leveladmin.rbac.test+${Date.now()}@agrilearn.local`;

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function assert(condition, label) {
  if (!condition) {
    const err = new Error(`FAIL: ${label}`);
    err.isAssert = true;
    throw err;
  }
  console.log(`  OK — ${label}`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!uri || !email || !password) {
    console.error("Need MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(normalizeMongoUri(uri), {
    serverSelectionTimeoutMS: 15000,
  });

  const results = [];
  let testAdminId = null;

  try {
    console.log("\n1) Super Admin login (existing credentials)");
    const login = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email, password },
    });
    assert(login.status === 200 && login.data?.token, "Super Admin can log in");
    assert(
      login.data.admin?.role === "super_admin" ||
        login.data.admin?.isSuperAdmin === true,
      "Existing account is Super Admin"
    );
    const superToken = login.data.token;
    results.push("super_login");

    console.log("\n2) Super Admin overview / all levels");
    const overview = await api("/api/admin/overview", { token: superToken });
    assert(overview.status === 200, "Super Admin overview 200");
    assert(overview.data.scopedLevel == null, "Super Admin scopedLevel is null (all)");
    results.push("super_overview");

    const studentsAll = await api("/api/admin/students", { token: superToken });
    assert(studentsAll.status === 200, "Super Admin can list students");
    results.push("super_students");

    console.log("\n3) Create temporary 100 Level Admin");
    const created = await api("/api/admin/administrators", {
      method: "POST",
      token: superToken,
      body: {
        fullName: "RBAC Test Level Admin",
        email: TEST_EMAIL,
        assignedLevel: "100",
        setupMethod: "manual_password",
        password: "RbacTestAdmin1",
        confirmPassword: "RbacTestAdmin1",
      },
    });
    assert(created.status === 201, "Create Level Admin returns 201");
    assert(
      !created.data?.credentials?.temporaryPassword &&
        !created.data?.credentials?.password,
      "Password is not returned in create response"
    );
    testAdminId = created.data.administrator._id;
    const levelPassword = "RbacTestAdmin1";
    results.push("create_level_admin");

    console.log("\n4) Level Admin login + 100-level access");
    const levelLogin = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email: TEST_EMAIL, password: levelPassword },
    });
    assert(levelLogin.status === 200, "100 Level Admin can log in");
    assert(levelLogin.data.admin?.role === "level_admin", "Role is level_admin");
    assert(levelLogin.data.admin?.assignedLevel === "100", "Assigned level is 100");
    const levelToken = levelLogin.data.token;
    results.push("level_login");

    const levelStudents = await api("/api/admin/students?level=100", {
      token: levelToken,
    });
    assert(levelStudents.status === 200, "Level Admin can list 100 Level students");
    const leaked = (levelStudents.data.students || []).some((s) => s.level !== "100");
    assert(!leaked, "100 Level list contains only 100 Level students");
    results.push("level_100_ok");

    console.log("\n5) Level Admin blocked from other levels");
    const other = await api("/api/admin/students?level=200", { token: levelToken });
    assert(other.status === 403, "Level Admin cannot query 200 Level (403)");
    results.push("level_200_blocked");

    const notesOther = await api("/api/admin/notes?level=300", { token: levelToken });
    assert(notesOther.status === 403, "Level Admin cannot query 300 Level notes (403)");
    results.push("notes_other_blocked");

    console.log("\n6) Level Admin cannot manage administrators");
    const adminsForbidden = await api("/api/admin/administrators", {
      token: levelToken,
    });
    assert(adminsForbidden.status === 403, "Level Admin cannot list administrators");
    const createForbidden = await api("/api/admin/administrators", {
      method: "POST",
      token: levelToken,
      body: {
        fullName: "Should Fail",
        email: "should.fail@agrilearn.local",
        assignedLevel: "200",
      },
    });
    assert(createForbidden.status === 403, "Level Admin cannot create administrators");
    results.push("admins_blocked");

    console.log("\n7) Level Admin cannot access Data Management");
    const dm = await api("/api/admin/data-management/resources", {
      token: levelToken,
    });
    assert(dm.status === 403, "Level Admin cannot access data management");
    results.push("dm_blocked");

    console.log("\n8) Level Admin cannot change own permissions via profile");
    const profile = await api("/api/admin/profile", {
      method: "PATCH",
      token: levelToken,
      body: { role: "super_admin", assignedLevel: "500" },
    });
    assert(profile.status === 200, "Profile update still succeeds for name-safe fields");
    const me = await api("/api/admin/auth/me", { token: levelToken });
    assert(me.data.admin?.role === "level_admin", "Role unchanged after profile PATCH");
    assert(me.data.admin?.assignedLevel === "100", "Assigned level unchanged");
    results.push("self_promote_blocked");

    console.log("\n9) Super Admin can change assigned level");
    const relevel = await api(`/api/admin/administrators/${testAdminId}`, {
      method: "PATCH",
      token: superToken,
      body: { assignedLevel: "200" },
    });
    assert(relevel.status === 200, "Super Admin can change assigned level");
    assert(
      relevel.data.administrator?.assignedLevel === "200",
      "Assigned level is now 200"
    );
    // Restore to 100 for remaining tests
    await api(`/api/admin/administrators/${testAdminId}`, {
      method: "PATCH",
      token: superToken,
      body: { assignedLevel: "100" },
    });
    results.push("super_change_level");

    console.log("\n10) Deactivated admin loses access");
    const deact = await api(`/api/admin/administrators/${testAdminId}`, {
      method: "PATCH",
      token: superToken,
      body: { isActive: false },
    });
    assert(deact.status === 200, "Super Admin can deactivate Level Admin");
    const deadMe = await api("/api/admin/auth/me", { token: levelToken });
    assert(deadMe.status === 403, "Deactivated token rejected on /me");
    const deadLogin = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email: TEST_EMAIL, password: levelPassword },
    });
    assert(deadLogin.status === 403, "Deactivated admin cannot log in");
    results.push("deactivate_blocks");

    // Reactivate then remove the temporary test admin (cleanup only)
    await api(`/api/admin/administrators/${testAdminId}`, {
      method: "PATCH",
      token: superToken,
      body: { isActive: true },
    });
    const removed = await api(`/api/admin/administrators/${testAdminId}`, {
      method: "DELETE",
      token: superToken,
    });
    assert(removed.status === 200, "Temporary Level Admin cleaned up");
    testAdminId = null;
    results.push("cleanup");

    console.log("\n11) Helper unit checks");
    const fakeLevel = {
      role: "level_admin",
      assignedLevel: "100",
    };
    assert(resolveScopedLevel(fakeLevel, null) === "100", "resolveScopedLevel forces assigned");
    try {
      resolveScopedLevel(fakeLevel, "200");
      assert(false, "resolveScopedLevel should throw for other level");
    } catch (e) {
      assert(e.code === "ADMIN_LEVEL_FORBIDDEN", "resolveScopedLevel forbids other level");
    }
    const filter = {};
    applyAdminLevelFilter(fakeLevel, filter, "100");
    assert(filter.level === "100", "applyAdminLevelFilter sets level");
    assert(isSuperAdmin({ role: "admin" }) === true, "Legacy role admin is super");
    results.push("helpers");

    console.log("\n=== RBAC tests passed ===");
    console.log(`Checks: ${results.join(", ")}`);
  } catch (error) {
    console.error("\n=== RBAC tests failed ===");
    console.error(error.message);
    if (testAdminId) {
      try {
        await Admin.deleteOne({ _id: testAdminId });
        console.log("Cleaned up temporary Level Admin after failure.");
      } catch {
        /* ignore */
      }
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
