const assert = require("assert");
const {
  studentOwnLevel,
  assertStudentCommunityLevel,
  assertStudentCanPost,
  assertStudentCanRead,
  assertAdminCommunityLevel,
} = require("../utils/communityAccess");
const { isSuperAdmin, resolveScopedLevel } = require("../utils/adminAccess");

function expectThrow(fn, snippet) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "expected an error");
  assert.ok(
    String(caught.message).includes(snippet),
    `expected "${snippet}" in "${caught.message}"`
  );
}

function run() {
  const student100 = { _id: "s1", level: "100", communityRestricted: false };
  const student200 = { _id: "s2", level: "200", communityRestricted: false };
  const restricted = { _id: "s3", level: "100", communityRestricted: true };

  assert.strictEqual(studentOwnLevel(student100), "100");
  assert.strictEqual(assertStudentCommunityLevel(student100), "100");
  assert.strictEqual(assertStudentCommunityLevel(student100, "100"), "100");
  expectThrow(
    () => assertStudentCommunityLevel(student100, "200"),
    "own level community"
  );
  expectThrow(
    () => assertStudentCommunityLevel(student200, "100"),
    "own level community"
  );
  expectThrow(() => assertStudentCanPost(restricted), "restricted");
  expectThrow(() => assertStudentCanRead(restricted, "100"), "restricted");
  expectThrow(
    () => assertStudentCanRead(student100, "200"),
    "own level community"
  );
  assert.strictEqual(assertStudentCanPost(student100), "100");
  assert.strictEqual(assertStudentCanRead(student100), "100");

  const superAdmin = { role: "super_admin", assignedLevel: null };
  const levelAdmin = { role: "level_admin", assignedLevel: "300" };
  assert.strictEqual(isSuperAdmin(superAdmin), true);
  assert.strictEqual(assertAdminCommunityLevel(superAdmin, "500"), "500");
  expectThrow(
    () => assertAdminCommunityLevel(superAdmin, ""),
    "valid academic level"
  );
  assert.strictEqual(assertAdminCommunityLevel(levelAdmin, "300"), "300");
  expectThrow(
    () => assertAdminCommunityLevel(levelAdmin, "100"),
    "only have access"
  );
  assert.strictEqual(resolveScopedLevel(levelAdmin), "300");

  console.log("community access checks passed");
}

run();
