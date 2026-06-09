import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy string values with a single space", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values (false, null, undefined, empty string)", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("supports conditional className patterns", () => {
    const active = true;
    const disabled = false;
    expect(cx("btn", active && "btn--active", disabled && "btn--disabled")).toBe(
      "btn btn--active",
    );
  });

  it("returns an empty string when no truthy values are provided", () => {
    expect(cx(false, null, undefined, "")).toBe("");
  });
});
