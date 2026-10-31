/**
 * Non-destructive tests for Level Admin invite + manual password creation.
 * Creates temporary admins, verifies flows, then removes them.
 *
 * Usage: node src/scripts/testAdminInviteFlows.js
 */
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { normalizeMongoUri } = require("../config/db");
const { hashInviteToken } = require("../utils/adminPassword");

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}`;
const stamp = Date.now();
const INVITE_EMAIL = `invite.flow+${stamp}@agrilearn.local`;
const MANUAL_EMAIL = `manual.flow+${stamp}@agrilearn.local`;

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
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
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`  OK — ${label}`);
}

async function main() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!process.env.MONGODB_URI || !email || !password) {
    console.error("Need MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD");
    process.exit(1);
  }

  await mongoose.connect(normalizeMongoUri(process.env.MONGODB_URI), {
    serverSelectionTimeoutMS: 15000,
  });

  const cleanupIds = [];

  try {
    console.log("\n0) Super Admin login");
    const login = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email, password },
    });
    assert(login.status === 200, "Super Admin can still log in");
    const superToken = login.data.token;

    console.log("\n1) Invitation link creation");
    const createdInvite = await api("/api/admin/administrators", {
      method: "POST",
      token: superToken,
      body: {
        fullName: "Invite Flow Admin",
        email: INVITE_EMAIL,
        assignedLevel: "100",
        setupMethod: "invite",
      },
    });
    assert(createdInvite.status === 201, "Invite create returns 201");
    assert(createdInvite.data.credentials?.inviteUrl, "Invite URL returned");
    assert(
      !createdInvite.data.credentials?.temporaryPassword &&
        !createdInvite.data.credentials?.password,
      "No plaintext password in invite response"
    );
    assert(
      !createdInvite.data.credentials?.inviteToken,
      "Raw invite token not exposed separately"
    );
    const inviteUrl = createdInvite.data.credentials.inviteUrl;
    const token = new URL(inviteUrl).searchParams.get("token");
    assert(Boolean(token), "Invite URL contains token");
    cleanupIds.push(createdInvite.data.administrator._id);

    const pendingDoc = await Admin.findById(
      createdInvite.data.administrator._id
    ).select("+inviteTokenHash +password");
    assert(pendingDoc.invitePending === true, "invitePending flag set");
    assert(
      pendingDoc.inviteTokenHash === hashInviteToken(token),
      "Token stored as hash only"
    );

    console.log("\n2) Pending invite cannot log in");
    const blockedLogin = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email: INVITE_EMAIL, password: "Anything12" },
    });
    assert(blockedLogin.status === 403, "Pending invite login blocked");

    console.log("\n3) Invite status + accept");
    const statusOk = await api(
      `/api/admin/auth/invite-status?token=${encodeURIComponent(token)}`
    );
    assert(statusOk.status === 200 && statusOk.data.valid, "Invite status valid");

    const accept = await api("/api/admin/auth/accept-invite", {
      method: "POST",
      body: {
        token,
        password: "LevelAdmin9",
        confirmPassword: "LevelAdmin9",
      },
    });
    assert(accept.status === 200, "Accept invite succeeds");
    assert(!accept.data.token, "Accept invite does not auto-issue session token");

    const reuse = await api("/api/admin/auth/accept-invite", {
      method: "POST",
      body: {
        token,
        password: "LevelAdmin9",
        confirmPassword: "LevelAdmin9",
      },
    });
    assert(reuse.status === 400, "Invite token is single-use");

    const invalid = await api("/api/admin/auth/invite-status?token=not-a-real-token");
    assert(invalid.status === 400, "Invalid token rejected");

    console.log("\n4) Invited admin can log in and is level-scoped");
    const levelLogin = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email: INVITE_EMAIL, password: "LevelAdmin9" },
    });
    assert(levelLogin.status === 200, "Invited admin can log in at /admin/login");
    const levelToken = levelLogin.data.token;
    const otherLevel = await api("/api/admin/students?level=200", {
      token: levelToken,
    });
    assert(otherLevel.status === 403, "Invited 100 admin blocked from 200");
    const ownLevel = await api("/api/admin/students?level=100", {
      token: levelToken,
    });
    assert(ownLevel.status === 200, "Invited admin can access assigned level");

    console.log("\n5) Manual password creation");
    const createdManual = await api("/api/admin/administrators", {
      method: "POST",
      token: superToken,
      body: {
        fullName: "Manual Flow Admin",
        email: MANUAL_EMAIL,
        assignedLevel: "300",
        setupMethod: "manual_password",
        password: "ManualPass1",
        confirmPassword: "ManualPass1",
      },
    });
    assert(createdManual.status === 201, "Manual create returns 201");
    assert(
      !createdManual.data.credentials?.temporaryPassword &&
        !createdManual.data.credentials?.password &&
        !JSON.stringify(createdManual.data).includes("ManualPass1"),
      "Manual password never returned in API response"
    );
    cleanupIds.push(createdManual.data.administrator._id);

    const mismatch = await api("/api/admin/administrators", {
      method: "POST",
      token: superToken,
      body: {
        fullName: "Mismatch Admin",
        email: `mismatch+${stamp}@agrilearn.local`,
        assignedLevel: "200",
        setupMethod: "manual_password",
        password: "ManualPass1",
        confirmPassword: "Different9",
      },
    });
    assert(mismatch.status === 400, "Password confirmation mismatch rejected");

    const weak = await api("/api/admin/administrators", {
      method: "POST",
      token: superToken,
      body: {
        fullName: "Weak Admin",
        email: `weak+${stamp}@agrilearn.local`,
        assignedLevel: "200",
        setupMethod: "manual_password",
        password: "short",
        confirmPassword: "short",
      },
    });
    assert(weak.status === 400, "Weak password rejected");

    const manualDoc = await Admin.findById(
      createdManual.data.administrator._id
    ).select("+password");
    assert(
      await bcrypt.compare("ManualPass1", manualDoc.password),
      "Stored password matches bcrypt hash"
    );
    assert(!manualDoc.password.includes("ManualPass1"), "Password not stored plaintext");

    const manualLogin = await api("/api/admin/auth/login", {
      method: "POST",
      body: { email: MANUAL_EMAIL, password: "ManualPass1" },
    });
    assert(manualLogin.status === 200, "Manual Level Admin can log in");
    const manualToken = manualLogin.data.token;
    const cross = await api("/api/admin/students?level=100", {
      token: manualToken,
    });
    assert(cross.status === 403, "300 Level Admin blocked from 100");

    console.log("\n6) Existing Super Admin still intact");
    const me = await api("/api/admin/auth/me", { token: superToken });
    assert(me.status === 200 && me.data.admin?.isSuperAdmin, "Super Admin session intact");

    console.log("\n=== Invite / manual password tests passed ===");
  } catch (error) {
    console.error("\n=== Tests failed ===");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (cleanupIds.length) {
      await Admin.deleteMany({ _id: { $in: cleanupIds } });
      console.log(`Cleaned up ${cleanupIds.length} temporary Level Admin(s).`);
    }
    await mongoose.disconnect();
  }
}

main();
