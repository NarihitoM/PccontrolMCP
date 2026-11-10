import assert from "node:assert/strict";
import { test } from "node:test";
import { center, elementLabel, formatElements, type UiElement, type UiRead } from "./ui.js";

const WINDOW = {
  handle: 42,
  title: "Untitled - Notepad",
  process: "notepad",
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  minimized: false,
  maximized: false,
};

function element(overrides: Partial<UiElement>): UiElement {
  return {
    index: 0,
    type: "Button",
    name: "",
    value: "",
    automationId: "",
    x: 100,
    y: 200,
    width: 80,
    height: 30,
    enabled: true,
    focused: false,
    ...overrides,
  };
}

test("center rounds to the middle of the element", () => {
  assert.deepEqual(center(element({ x: 10, y: 20, width: 15, height: 9 })), { x: 18, y: 25 });
});

test("elementLabel falls back from name to value, id and type", () => {
  assert.equal(elementLabel(element({ name: "Save" })), "Save");
  assert.equal(elementLabel(element({ value: "hello" })), "hello");
  assert.equal(elementLabel(element({ automationId: "okButton" })), "okButton");
  assert.equal(elementLabel(element({})), "Button");
});

test("formatElements lists elements with centers and flags", () => {
  const read: UiRead = {
    window: WINDOW,
    truncated: false,
    elements: [
      element({ index: 0, name: "Save", automationId: "save" }),
      element({ index: 1, type: "Edit", value: "draft  text\nline", focused: true }),
      element({ index: 2, name: "Print", enabled: false }),
    ],
  };

  assert.equal(
    formatElements(read),
    [
      'Window "Untitled - Notepad" (notepad) [42]',
      '[0] Button "Save" id=save (140,215)',
      '[1] Edit value="draft text line" (140,215) focused',
      '[2] Button "Print" (140,215) disabled',
    ].join("\n"),
  );
});

test("formatElements shortens long names and notes truncation", () => {
  const read: UiRead = { window: WINDOW, truncated: true, elements: [element({ name: "x".repeat(200) })] };
  const text = formatElements(read);
  assert.match(text, /"x{77}\.\.\."/);
  assert.match(text, /more elements not shown/);
});

test("formatElements suggests a screenshot when nothing is readable", () => {
  assert.match(formatElements({ window: WINDOW, truncated: false, elements: [] }), /Use screenshot/);
});
