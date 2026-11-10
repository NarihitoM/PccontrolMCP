import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReply } from "./protocol.js";

test("parseReply recognises the ready line, even with a BOM", () => {
  assert.deepEqual(parseReply('﻿{"ready":true}\r'), { kind: "ready" });
});

test("parseReply returns results and errors with their id", () => {
  assert.deepEqual(parseReply('{"id":3,"ok":true,"result":{"x":1}}'), {
    kind: "result",
    id: 3,
    ok: true,
    result: { x: 1 },
  });
  assert.deepEqual(parseReply('{"id":4,"ok":false,"error":"boom"}'), { kind: "result", id: 4, ok: false, error: "boom" });
});

test("parseReply ignores noise and malformed lines", () => {
  assert.equal(parseReply("WARNING: something"), null);
  assert.equal(parseReply("{not json"), null);
  assert.equal(parseReply('{"id":"x","ok":true}'), null);
});
