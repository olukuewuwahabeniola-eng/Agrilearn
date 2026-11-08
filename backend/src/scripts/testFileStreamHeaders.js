const assert = require("assert");
const {
  isPdf,
  resolveContentType,
  contentDisposition,
  setFileStreamHeaders,
  isDownloadQuery,
} = require("../utils/fileStreamHeaders");

assert.strictEqual(isPdf("application/pdf", "notes.bin"), true);
assert.strictEqual(isPdf("application/octet-stream", "lecture.pdf"), true);
assert.strictEqual(isPdf("image/jpeg", "page.jpg"), false);

assert.strictEqual(
  resolveContentType("application/octet-stream", "ANP517.pdf"),
  "application/pdf"
);
assert.strictEqual(resolveContentType("application/pdf", "file"), "application/pdf");
assert.strictEqual(resolveContentType("image/png", "p.png"), "image/png");

assert.ok(contentDisposition("notes.pdf", false).startsWith("inline;"));
assert.ok(contentDisposition("notes.pdf", true).startsWith("attachment;"));

const headers = {};
const res = {
  setHeader(name, value) {
    headers[name] = value;
  },
};
setFileStreamHeaders(res, {
  mimeType: "application/octet-stream",
  filename: "paper.pdf",
  download: false,
  size: 12,
});
assert.strictEqual(headers["Content-Type"], "application/pdf");
assert.ok(headers["Content-Disposition"].startsWith("inline;"));
assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
assert.strictEqual(headers["Content-Length"], "12");

assert.strictEqual(isDownloadQuery({ query: { download: "1" } }), true);
assert.strictEqual(isDownloadQuery({ query: {} }), false);

console.log("fileStreamHeaders tests passed");
