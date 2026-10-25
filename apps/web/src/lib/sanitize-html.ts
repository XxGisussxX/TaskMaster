export const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "a",
  "div",
  "label",
  "input",
  "span",
]);

export const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href"],
  ul: ["data-type"],
  li: ["data-type", "data-checked"],
  input: ["type", "checked", "disabled"],
};

export const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "template",
  "noscript",
]);

const HAS_MARKUP = /<[a-z][\s\S]*>/i;

export function hasMarkup(raw: string): boolean {
  return HAS_MARKUP.test(raw);
}

function isSafeUrl(value: string) {
  const url = value.trim().toLowerCase();
  // `//host` es protocol-relative: descartado.
  if (url.startsWith("//")) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("/") ||
    url.startsWith("#")
  );
}

export function sanitizeHtml(raw: string): string {
  if (typeof window === "undefined" || !raw) return "";
  const cleaned = raw.replace(/<!--[\s\S]*?-->/g, "");
  const doc = new DOMParser().parseFromString(cleaned, "text/html");

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();

    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag] ?? [];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === "input") {
      if ((el.getAttribute("type") || "").toLowerCase() !== "checkbox") {
        el.remove();
        continue;
      }
      el.setAttribute("disabled", "");
    }

    if (tag === "a" && el.hasAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }

  return doc.body.innerHTML;
}

export function sanitizeRichText(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const sanitized = sanitizeHtml(raw);
  if (sanitized.trim() === "") {
    if (HAS_MARKUP.test(raw)) {
      return null;
    }
    return raw;
  }
  return sanitized;
}
