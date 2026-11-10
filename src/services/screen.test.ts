import assert from "node:assert/strict";
import { test } from "node:test";
import { describeCapture, formatMonitors } from "./screen.js";

const BASE = { data: "", format: "png" as const, x: 0, y: 0, screenWidth: 2560, screenHeight: 1440 };

test("describeCapture says coordinates match when the image is not scaled", () => {
  assert.equal(
    describeCapture({ ...BASE, screenWidth: 1280, screenHeight: 720, width: 1280, height: 720 }),
    "Screenshot 1280x720. Image coordinates match click coordinates.",
  );
});

test("describeCapture gives the scale factor for scaled images", () => {
  assert.equal(
    describeCapture({ ...BASE, width: 1280, height: 720 }),
    "Screenshot 1280x720, scaled from screen area 2560x1440 at (0,0). Multiply image coordinates by 2.000 for click.",
  );
});

test("describeCapture adds the monitor offset", () => {
  assert.match(describeCapture({ ...BASE, x: -1920, width: 1280, height: 720 }), /then add \(-1920,0\) for click/);
  assert.match(
    describeCapture({ ...BASE, x: 2560, screenWidth: 1280, screenHeight: 720, width: 1280, height: 720 }),
    /Add \(2560,0\) to image coordinates/,
  );
});

test("formatMonitors marks the primary monitor", () => {
  assert.equal(
    formatMonitors([
      { index: 0, name: "\\\\.\\DISPLAY1", primary: true, x: 0, y: 0, width: 2560, height: 1440 },
      { index: 1, name: "\\\\.\\DISPLAY2", primary: false, x: 2560, y: 0, width: 1920, height: 1080 },
    ]),
    "[0] 2560x1440 at (0,0) primary\n[1] 1920x1080 at (2560,0)",
  );
});
