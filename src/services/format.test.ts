import assert from "node:assert/strict";
import { test } from "node:test";
import { scrollAmount } from "./input.js";
import { formatInfo, formatVolume } from "./system.js";
import { formatWindows } from "./windows.js";

test("scrollAmount maps directions to wheel signs", () => {
  assert.deepEqual(scrollAmount("up", 3), { amount: 3, horizontal: false });
  assert.deepEqual(scrollAmount("down", 3), { amount: -3, horizontal: false });
  assert.deepEqual(scrollAmount("right", 2), { amount: 2, horizontal: true });
  assert.deepEqual(scrollAmount("left", 2), { amount: -2, horizontal: true });
});

test("formatWindows marks the foreground window and states", () => {
  const base = { process: "chrome", x: 0, y: 0, width: 800, height: 600, minimized: false, maximized: false };
  assert.equal(
    formatWindows(
      [
        { ...base, handle: 1, title: "Inbox - Chrome " },
        { ...base, handle: 2, title: "Notes", process: "notepad", minimized: true },
      ],
      1,
    ),
    '* [1] "Inbox - Chrome" (chrome) 800x600 at (0,0)\n  [2] "Notes" (notepad) 800x600 at (0,0) minimized',
  );
  assert.equal(formatWindows([], 0), "No open windows.");
});

test("formatVolume and formatInfo read naturally", () => {
  assert.equal(formatVolume({ volume: 40, muted: true }), "Volume 40% (muted)");
  assert.equal(
    formatInfo({
      computer: "PC",
      os: "Windows 11",
      cpu: "Intel",
      cpuLoad: 12,
      memoryTotalMb: 16384,
      memoryFreeMb: 8192,
      uptimeMinutes: 1565,
      batteryPercent: 80,
      charging: false,
    }),
    [
      "Computer: PC",
      "OS: Windows 11",
      "CPU: Intel (12% load)",
      "Memory: 8.0 / 16.0 GB used",
      "Battery: 80% (on battery)",
      "Uptime: 1d 2h 5m",
    ].join("\n"),
  );
});
