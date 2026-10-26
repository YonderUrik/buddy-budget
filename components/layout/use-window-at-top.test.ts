import { describe, expect, it } from "vitest";
import { opensKeyboard, windowNeedsReset } from "./use-window-at-top";

describe("opensKeyboard", () => {
  it("counts text fields and editable content, not buttons, toggles or read-only fields", () => {
    expect(opensKeyboard({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(opensKeyboard({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(opensKeyboard({ tagName: "INPUT" })).toBe(true);
    expect(opensKeyboard({ tagName: "TEXTAREA" })).toBe(true);
    expect(opensKeyboard({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(opensKeyboard({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(opensKeyboard({ tagName: "INPUT", type: "text", readOnly: true })).toBe(false);
    expect(opensKeyboard({ tagName: "BUTTON" })).toBe(false);
    expect(opensKeyboard({ tagName: "BODY" })).toBe(false);
    expect(opensKeyboard(null)).toBe(false);
  });
});

describe("windowNeedsReset", () => {
  it("brings the window back once the keyboard is gone", () => {
    expect(windowNeedsReset({ x: 0, y: 290 }, { tagName: "BODY" })).toBe(true);
    expect(windowNeedsReset({ x: 0, y: 290 }, { tagName: "BUTTON" })).toBe(true);
  });

  it("leaves the window where iOS put it while a field has the keyboard, and does nothing at the top", () => {
    expect(windowNeedsReset({ x: 0, y: 290 }, { tagName: "INPUT", type: "text" })).toBe(false);
    expect(windowNeedsReset({ x: 0, y: 0 }, { tagName: "BODY" })).toBe(false);
  });
});
