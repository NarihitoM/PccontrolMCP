import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPath, checkUrl, filterApps, matchApp } from "./apps.js";

const APPS = [
  { name: "Google Chrome", id: "Chrome" },
  { name: "Notepad", id: "notepad" },
  { name: "Notepad++", id: "npp" },
  { name: "Spotify", id: "spotify" },
  { name: "Visual Studio Code", id: "code" },
];

test("matchApp prefers exact, then prefix, then word, then substring matches", () => {
  assert.equal(matchApp(APPS, "notepad")?.id, "notepad");
  assert.equal(matchApp(APPS, "spot")?.id, "spotify");
  assert.equal(matchApp(APPS, "chrome")?.id, "Chrome");
  assert.equal(matchApp(APPS, "studio")?.id, "code");
  assert.equal(matchApp(APPS, "tify")?.id, "spotify");
});

test("matchApp returns nothing for unknown or empty names", () => {
  assert.equal(matchApp(APPS, "photoshop"), undefined);
  assert.equal(matchApp(APPS, "  "), undefined);
});

test("filterApps searches names case-insensitively", () => {
  assert.deepEqual(
    filterApps(APPS, "NOTE").map((app) => app.id),
    ["notepad", "npp"],
  );
  assert.equal(filterApps(APPS).length, APPS.length);
});

test("checkUrl only accepts http and https", () => {
  assert.equal(checkUrl(" https://example.com/a "), "https://example.com/a");
  assert.throws(() => checkUrl("file:///C:/Windows/notepad.exe"), /Only http and https/);
  assert.throws(() => checkUrl("example.com"), /not a valid URL/);
});

test("checkPath refuses programs and scripts", () => {
  assert.equal(checkPath("C:\\Users\\me\\Downloads"), "C:\\Users\\me\\Downloads");
  assert.equal(checkPath("C:\\notes\\todo.txt"), "C:\\notes\\todo.txt");
  for (const path of ["C:\\x\\setup.exe", "run.BAT", "a.ps1", "link.lnk", "page.hta"]) {
    assert.throws(() => checkPath(path), /does not run programs/);
  }
});
