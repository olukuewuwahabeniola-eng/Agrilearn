/**
 * Offline smoke checks for Cloudinary dual-storage helpers.
 * Does not call the Cloudinary network API or mutate MongoDB.
 */
const assert = require("assert");
const path = require("path");
const fsp = require("fs/promises");

process.chdir(path.join(__dirname, "..", ".."));

delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;

const cloudinaryUtil = require("../utils/cloudinary");
const noteStorage = require("../utils/noteStorage");
const pastQuestionStorage = require("../utils/pastQuestionStorage");

async function main() {
  assert.strictEqual(cloudinaryUtil.isCloudinaryConfigured(), false);

  const encoded = cloudinaryUtil.encodeCloudinaryStoragePath(
    "raw",
    "agrilearn/notes/official/100/AGR101/demo.pdf"
  );
  assert.strictEqual(
    encoded,
    "cloudinary:raw:agrilearn/notes/official/100/AGR101/demo.pdf"
  );
  assert.strictEqual(cloudinaryUtil.isCloudinaryStoragePath(encoded), true);
  assert.strictEqual(
    cloudinaryUtil.isCloudinaryStoragePath("notes/100/AGR101/file.pdf"),
    false
  );

  const parsed = cloudinaryUtil.parseCloudinaryStoragePath(encoded);
  assert.deepStrictEqual(parsed, {
    resourceType: "raw",
    publicId: "agrilearn/notes/official/100/AGR101/demo.pdf",
  });

  const attempts = cloudinaryUtil.downloadAttemptsFor(encoded);
  assert.ok(attempts.length >= 2);
  assert.strictEqual(attempts[0].deliveryType, "authenticated");
  assert.strictEqual(attempts[0].publicId.endsWith(".pdf"), true);
  assert.strictEqual(attempts[1].format, "pdf");
  assert.ok(!attempts[1].publicId.endsWith(".pdf"));

  // New uploads must refuse when Cloudinary is not configured.
  let refused = false;
  try {
    await noteStorage.savePdfBuffer({
      buffer: Buffer.from("%PDF-1.4"),
      level: "100",
      courseCode: "AGR101",
      originalName: "smoke.pdf",
    });
  } catch (error) {
    refused = error.code === "CLOUDINARY_NOT_CONFIGURED";
  }
  assert.strictEqual(refused, true);

  // Private download URL must target Admin download API (not delivery CDN).
  process.env.CLOUDINARY_CLOUD_NAME = "demo_cloud";
  process.env.CLOUDINARY_API_KEY = "123456789012345";
  process.env.CLOUDINARY_API_SECRET = "abcdef_smoke_secret_value_0001";
  const downloadUrl = cloudinaryUtil.buildPrivateDownloadUrl({
    resourceType: "raw",
    publicId: "agrilearn/notes/official/100/AGR101/demo.pdf",
    format: "pdf",
    deliveryType: "authenticated",
  });
  assert.ok(
    downloadUrl.includes("api.cloudinary.com"),
    "expected Admin API download URL"
  );
  assert.ok(
    downloadUrl.includes("/raw/download"),
    "expected raw download endpoint"
  );
  assert.ok(
    !downloadUrl.includes("/authenticated/raw/"),
    "must not use authenticated delivery CDN path that returns 401"
  );

  // Clear fake credentials for local disk tests.
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  // Legacy local dual-read: write a file under uploads root and stream it back.
  const tmpRoot = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "_smoke_cloudinary"
  );
  process.env.UPLOADS_DIR = tmpRoot;
  const relative = "notes/100/AGR101/legacy-smoke.pdf";
  const absolute = path.join(tmpRoot, relative);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  const buffer = Buffer.from("%PDF-1.4 legacy dual-read");
  await fsp.writeFile(absolute, buffer);

  const readBack = await noteStorage.readStoredPdf(relative);
  assert.ok(Buffer.compare(readBack, buffer) === 0);

  const stream = await noteStorage.openStoredReadStream(relative);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.ok(Buffer.compare(Buffer.concat(chunks), buffer) === 0);

  await noteStorage.deleteStoredNoteFile(relative);

  // Past-question local delete must not throw "fsp is not defined".
  const pqRelative = "past-questions/100/AGR101/legacy-pq.pdf";
  const pqAbsolute = path.join(tmpRoot, pqRelative);
  await fsp.mkdir(path.dirname(pqAbsolute), { recursive: true });
  await fsp.writeFile(pqAbsolute, Buffer.from("%PDF-1.4 pq"));
  await pastQuestionStorage.deleteStoredFile(pqRelative);
  let pqExists = true;
  try {
    await fsp.access(pqAbsolute);
  } catch {
    pqExists = false;
  }
  assert.strictEqual(pqExists, false);

  await fsp.rm(tmpRoot, { recursive: true, force: true });

  console.log("smokeCloudinaryStorage: OK");
}

main().catch((error) => {
  console.error("smokeCloudinaryStorage: FAIL", error);
  process.exitCode = 1;
});
