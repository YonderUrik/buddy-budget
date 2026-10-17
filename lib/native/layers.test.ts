import { describe, expect, it, vi } from "vitest";
import { closeTopLayer } from "./layers";

/** Minimal element: records the events dispatched to it. */
function layer(id: string) {
  return { id, contains: () => false, dispatchEvent: vi.fn(() => true) };
}

function root(layers: ReturnType<typeof layer>[]) {
  return { querySelectorAll: () => layers, activeElement: null } as unknown as Pick<Document, "querySelectorAll" | "activeElement">;
}

describe("closeTopLayer", () => {
  it("returns false when nothing is open", () => {
    expect(closeTopLayer(root([]))).toBe(false);
  });

  it("sends Escape to the last open popup only", () => {
    const dialog = layer("dialog");
    const menu = layer("menu");
    vi.stubGlobal("KeyboardEvent", class {
      constructor(public type: string, public init: { key: string }) {}
    });
    expect(closeTopLayer(root([dialog, menu]))).toBe(true);
    expect(dialog.dispatchEvent).not.toHaveBeenCalled();
    expect(menu.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "keydown", init: expect.objectContaining({ key: "Escape" }) }));
    vi.unstubAllGlobals();
  });
});
