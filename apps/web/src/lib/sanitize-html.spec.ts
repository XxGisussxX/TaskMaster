import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeRichText } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const result = sanitizeHtml("<p>hi</p><script>alert(1)</script>");
    expect(result).toContain("hi");
    expect(result).not.toContain("script");
  });

  it("preserves allowed tags", () => {
    const html =
      '<strong>bold</strong><em>em</em><a href="https://example.com">link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>em</em>");
    expect(result).toContain('href="https://example.com"');
  });

  it("blocks protocol-relative urls", () => {
    const result = sanitizeHtml('<a href="//evil.com">x</a>');
    expect(result).not.toContain("evil.com");
  });
});

describe("sanitizeRichText", () => {
  it("returns null when input is null/undefined", () => {
    expect(sanitizeRichText(null)).toBeNull();
    expect(sanitizeRichText(undefined)).toBeNull();
  });

  it("preserves plain text when no markup", () => {
    expect(sanitizeRichText("hello")).toBe("hello");
  });
});
