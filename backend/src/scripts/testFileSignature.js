const assert = require("assert");
const { assertFileSignature } = require("../utils/fileSignature");

function expectReject(fn) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    assert.strictEqual(error.code, "INVALID_MIME");
  }
  assert.ok(threw, "expected signature rejection");
}

const pdf = Buffer.from("%PDF-1.4 sample");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
]);

assertFileSignature(pdf, "application/pdf");
assertFileSignature(jpeg, "image/jpeg");
assertFileSignature(png, "image/png");
assertFileSignature(webp, "image/webp");

expectReject(() => assertFileSignature(Buffer.from("hello world!!"), "application/pdf"));
expectReject(() => assertFileSignature(pdf, "image/jpeg"));
expectReject(() => assertFileSignature(jpeg, "image/png"));

console.log("testFileSignature: all signature checks passed");
