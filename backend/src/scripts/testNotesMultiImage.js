const assert = require("assert");
const {
  collectNoteUploads,
  combinedContentHash,
  defaultNoteTitle,
  resolveNotePages,
  resolveNoteFormat,
} = require("../utils/notesUpload");
const {
  studentCanAccessNote,
  studentCanDeleteNote,
  buildLibraryFilter,
} = require("../utils/noteAccess");
const { hashBuffer } = require("../utils/noteStorage");

function fakeFile(name, mime, contents = "x") {
  return {
    originalname: name,
    mimetype: mime,
    buffer: Buffer.from(contents),
  };
}

function testCollectUploads() {
  const pdfOnly = collectNoteUploads({
    files: { pdf: [fakeFile("lecture.pdf", "application/pdf", "pdf-bytes")] },
  });
  assert.strictEqual(pdfOnly.format, "pdf");
  assert.strictEqual(pdfOnly.files.length, 1);

  const images = collectNoteUploads({
    files: {
      images: [
        fakeFile("p1.jpg", "image/jpeg", "one"),
        fakeFile("p2.png", "image/png", "two"),
        fakeFile("p3.webp", "image/webp", "three"),
      ],
    },
  });
  assert.strictEqual(images.format, "images");
  assert.strictEqual(images.files.length, 3);

  assert.throws(
    () =>
      collectNoteUploads({
        files: {
          pdf: [fakeFile("lecture.pdf", "application/pdf")],
          images: [fakeFile("p1.jpg", "image/jpeg")],
        },
      }),
    /either one PDF or a set of images/
  );
}

function testHashesAndTitles() {
  const a = Buffer.from("page-a");
  const b = Buffer.from("page-b");
  const combined = combinedContentHash([a, b]);
  const reversed = combinedContentHash([b, a]);
  assert.notStrictEqual(combined, reversed);
  assert.strictEqual(combinedContentHash([a]), hashBuffer(a));

  assert.strictEqual(
    defaultNoteTitle({
      titleInput: "Handwritten lecture",
      files: [fakeFile("ignored.jpg", "image/jpeg")],
      format: "images",
      courseCode: "AGR101",
    }),
    "Handwritten lecture"
  );
  assert.strictEqual(
    defaultNoteTitle({
      titleInput: "",
      files: [fakeFile("week-3.jpg", "image/jpeg")],
      format: "images",
      courseCode: "AGR101",
    }),
    "week-3"
  );
}

function testLegacyPages() {
  const legacy = {
    originalName: "old.pdf",
    storagePath: "notes/100/AGR101/old.pdf",
    mimeType: "application/pdf",
    size: 12,
  };
  const pages = resolveNotePages(legacy);
  assert.strictEqual(pages.length, 1);
  assert.strictEqual(resolveNoteFormat(legacy), "pdf");

  const imageNote = {
    format: "images",
    files: [
      { pageOrder: 1, originalName: "b.jpg", mimeType: "image/jpeg" },
      { pageOrder: 0, originalName: "a.jpg", mimeType: "image/jpeg" },
    ],
  };
  const ordered = resolveNotePages(imageNote);
  assert.strictEqual(ordered[0].originalName, "a.jpg");
  assert.strictEqual(ordered[1].originalName, "b.jpg");
  assert.strictEqual(resolveNoteFormat(imageNote), "images");
}

function testPrivacy() {
  const ownerId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const otherId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const personal = {
    level: "100",
    source: "personal",
    studentOwner: ownerId,
    uploadedBy: ownerId,
  };
  const official = {
    level: "100",
    source: "official",
    studentOwner: null,
  };
  const owner = { _id: ownerId, level: "100" };
  const peer = { _id: otherId, level: "100" };
  const otherLevel = { _id: ownerId, level: "200" };

  assert.strictEqual(studentCanAccessNote(personal, owner), true);
  assert.strictEqual(studentCanAccessNote(personal, peer), false);
  assert.strictEqual(studentCanAccessNote(personal, otherLevel), false);
  assert.strictEqual(studentCanAccessNote(official, owner), true);
  assert.strictEqual(studentCanAccessNote(official, peer), true);
  assert.strictEqual(studentCanDeleteNote(official, owner), false);
  assert.strictEqual(studentCanDeleteNote(personal, owner), true);
  assert.strictEqual(studentCanDeleteNote(personal, peer), false);

  const personalFilter = buildLibraryFilter(owner, "personal");
  assert.ok(
    personalFilter.$or.some(
      (clause) =>
        clause.source === "personal" && clause.studentOwner === owner._id
    )
  );
  const officialFilter = buildLibraryFilter(owner, "official");
  assert.ok(officialFilter.$or.some((clause) => clause.source === "official"));
}

function run() {
  testCollectUploads();
  testHashesAndTitles();
  testLegacyPages();
  testPrivacy();
  console.log("notes multi-image helper checks passed");
}

run();
