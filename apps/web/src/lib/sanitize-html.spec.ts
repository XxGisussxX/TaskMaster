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

  it("blocks javascript: with uppercase, tabs/spaces", () => {
    const result = sanitizeHtml(
      '<a href="JaVaScRiPt:alert(1)">x</a><a href="java\tscript:alert(2)">y</a><a href="java script:alert(3)">z</a>',
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("JaVaScRiPt:");
  });

  it("blocks data:, vbscript:", () => {
    const result = sanitizeHtml(
      '<a href="data:text/html,<script>alert(1)</script>">d</a><a href="vbscript:msgbox(1)">v</a>',
    );
    expect(result).not.toContain("data:");
    expect(result).not.toContain("vbscript:");
  });

  it("removes svg and math completely (including nested style/img onerror)", () => {
    const svg = sanitizeHtml(
      "<svg onload=alert(1)><style>*{}</style><image href=x onerror=alert(2)></svg>",
    );
    expect(svg).not.toContain("<svg");
    expect(svg).not.toContain("onload");
    expect(svg).not.toContain("onerror");
    expect(svg).not.toContain("<style>");

    const math = sanitizeHtml(
      "<math><style></style><img src=x onerror=alert(1)></math>",
    );
    expect(math).not.toContain("<math");
    expect(math).not.toContain("onerror");
  });

  it("blocks dangerous attributes", () => {
    const result = sanitizeHtml(
      '<p onclick="alert(1)" style="color:red">x</p><img srcdoc="<script>alert(1)</script>"><form formaction="javascript:alert(1)"></form>',
    );
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("style=");
    expect(result).not.toContain("srcdoc");
    expect(result).not.toContain("formaction");
    expect(result).toContain("x");
  });

  it("preserves valid links and checklists", () => {
    const html =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><input type="checkbox" checked disabled>done</li></ul><a href="/path#section">internal</a><a href="mailto:test@example.com">mail</a><a href="tel:+123456">tel</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain('data-type="taskList"');
    expect(result).toContain('type="checkbox"');
    expect(result).toContain("done");
    expect(result).toContain('href="/path#section"');
    expect(result).toContain("mailto:");
    expect(result).toContain("tel:");
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
