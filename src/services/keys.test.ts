import assert from "node:assert/strict";
import { test } from "node:test";
import { keyCode, parseCombo } from "./keys.js";

test("keyCode maps letters, digits and function keys", () => {
  assert.equal(keyCode("a"), 0x41);
  assert.equal(keyCode("Z"), 0x5a);
  assert.equal(keyCode("7"), 0x37);
  assert.equal(keyCode("f1"), 0x70);
  assert.equal(keyCode("F12"), 0x7b);
  assert.equal(keyCode("f24"), 0x87);
});

test("keyCode maps named keys and symbols case-insensitively", () => {
  assert.equal(keyCode("Enter"), 0x0d);
  assert.equal(keyCode("ESC"), 0x1b);
  assert.equal(keyCode("win"), 0x5b);
  assert.equal(keyCode("/"), 0xbf);
});

test("keyCode rejects unknown keys with a hint", () => {
  assert.throws(() => keyCode("hyper"), /Unknown key "hyper"/);
  assert.throws(() => keyCode("f25"), /Unknown key/);
});

test("parseCombo keeps the order of the keys", () => {
  assert.deepEqual(parseCombo("ctrl+shift+esc"), [0x11, 0x10, 0x1b]);
  assert.deepEqual(parseCombo(" alt + f4 "), [0x12, 0x73]);
  assert.deepEqual(parseCombo("ctrl+plus"), [0x11, 0xbb]);
});

test("parseCombo rejects empty parts", () => {
  assert.throws(() => parseCombo("ctrl+"), /Invalid key combo/);
  assert.throws(() => parseCombo(""), /Invalid key combo/);
});
