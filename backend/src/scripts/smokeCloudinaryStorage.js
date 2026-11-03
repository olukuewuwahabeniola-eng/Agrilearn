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

async function main() {
  assert.strictEqual(cloudinaryUtil.isCloudinaryConfigured(), false);

  const encoded = cloudinaryUtil.encodeCloudinaryStoragePath(
    "raw",
    "agrilearn/notes/official/100/AGR101/demo"
  );
  assert.strictEqual(
    encoded,
    "cloudinary:raw:agrilearn/notes/official/100/AGR101/demo"
  );
  assert.strictEqual(cloudinaryUtil.isCloudinaryStoragePath(encoded), true);
  assert.strictEqual(
    cloudinaryUtil.isCloudinaryStoragePath("notes/100/AGR101/file.pdf"),
    false
  );

  const parsed = cloudinaryUtil.parseCloudinaryStoragePath(encoded);
  assert.deepStrictEqual(parsed, {
    resourceType: "raw",
    publicId: "agrilearn/notes/official/100/AGR101/demo",
  });

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
  await fsp.rm(tmpRoot, { recursive: true, force: true });

  console.log("smokeCloudinaryStorage: OK");
}

main().catch((error) => {
  console.error("smokeCloudinaryStorage: FAIL", error);
  process.exitCode = 1;
});
