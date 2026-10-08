import { describe, it, expect } from "vitest";
import { MinimalTemplate } from "./MinimalTemplate";

describe("MinimalTemplate", () => {
  it("should render without errors", () => {
    expect(() => MinimalTemplate({ content: "Hello World" })).not.toThrow();
  });

  it("should accept content prop", () => {
    const result = MinimalTemplate({ content: "Test content" });
    expect(result).toBeDefined();
  });
});
