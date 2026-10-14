import { describe, expect, it } from "vitest";
import { MAX_HTML_LENGTH, sanitizeRichText } from "./html";

describe("sanitizeRichText", () => {
  it("deja intacto el HTML que produce TipTap", () => {
    const html =
      "<p>Hola <strong>mundo</strong> y <em>adiós</em></p>" +
      "<ul><li>uno</li><li>dos</li></ul>" +
      "<h2>Título</h2><blockquote><p>cita</p></blockquote>" +
      "<p><code>const x = 1</code></p><hr /><pre>bloque</pre>";

    expect(sanitizeRichText(html, "test")).toBe(html);
  });

  it("preserva las task lists de TipTap", () => {
    const html =
      '<ul data-type="taskList"><li data-checked="false" data-type="taskItem">' +
      '<label><input type="checkbox" checked="checked"><span></span></label>' +
      "<div><p>tarea</p></div></li></ul>";

    const clean = sanitizeRichText(html, "test");

    expect(clean).toContain('data-type="taskList"');
    expect(clean).toContain('data-type="taskItem"');
    expect(clean).toContain('data-checked="false"');
    expect(clean).toContain('type="checkbox"');
  });

  it("elimina <script> y su contenido", () => {
    const clean = sanitizeRichText(
      "<p>ok</p><script>alert('xss')</script>",
      "test",
    );

    expect(clean).toBe("<p>ok</p>");
    expect(clean).not.toContain("alert");
  });

  it("elimina handlers on* de cualquier tag", () => {
    const clean = sanitizeRichText(
      '<p onclick="steal()" onmouseover="steal()">texto</p>',
      "test",
    );

    expect(clean).toBe("<p>texto</p>");
    expect(clean).not.toContain("steal");
  });

  it("elimina iframes, objects y embeds", () => {
    const clean = sanitizeRichText(
      '<p>a</p><iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">',
      "test",
    );

    expect(clean).toBe("<p>a</p>");
  });

  it("mata javascript: en href conservando el texto del enlace", () => {
    const clean = sanitizeRichText(
      '<p><a href="javascript:alert(1)">click</a></p>',
      "test",
    );

    expect(clean).not.toContain("javascript");
    expect(clean).toContain("click");
  });

  it("mata esquemas no permitidos con entity encoding", () => {
    // `&#106;avascript:` es la misma cosa para el parser que para el navegador.
    const clean = sanitizeRichText(
      '<a href="&#106;avascript:alert(1)">x</a>',
      "test",
    );

    expect(clean.toLowerCase()).not.toContain("javascript");
  });

  it("mata data: en href", () => {
    const clean = sanitizeRichText(
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
      "test",
    );

    expect(clean.toLowerCase()).not.toContain("data:");
  });

  it("conserva enlaces http, https y mailto y les pone rel seguro", () => {
    const clean = sanitizeRichText(
      '<p><a href="https://taskmaster.app">web</a> <a href="mailto:a@b.com">mail</a></p>',
      "test",
    );

    expect(clean).toContain('href="https://taskmaster.app"');
    expect(clean).toContain('href="mailto:a@b.com"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it("elimina style en cualquier tag (position:fixed para clickjacking)", () => {
    const clean = sanitizeRichText(
      '<p style="position:fixed;top:0;left:0;width:100vw;height:100vh">overlay</p>',
      "test",
    );

    expect(clean).not.toContain("style");
    expect(clean).toContain("overlay");
  });

  it("no deja que un input sea otra cosa que checkbox", () => {
    const clean = sanitizeRichText(
      '<input type="text" name="password" value="x"><input type="image" src="y">',
      "test",
    );

    expect(clean).not.toContain('type="text"');
    expect(clean).not.toContain('type="image"');
    expect(clean).not.toContain('name="password"');
  });

  it("no deja forms, botones ni selects", () => {
    const clean = sanitizeRichText(
      '<form action="https://evil.test"><button>enviar</button><select><option>a</option></select></form>',
      "test",
    );

    expect(clean).not.toContain("<form");
    expect(clean).not.toContain("<button");
    expect(clean).not.toContain("<select");
  });

  it("desvuelve tags desconocidos conservando el texto", () => {
    const clean = sanitizeRichText(
      "<p>visible</p><marquee>texto</marquee><custom>otro</custom>",
      "test",
    );

    expect(clean).toContain("visible");
    expect(clean).toContain("texto");
    expect(clean).toContain("otro");
    expect(clean).not.toContain("marquee");
    expect(clean).not.toContain("<custom");
  });

  it("elimina comentarios", () => {
    expect(sanitizeRichText("<p>a</p><!-- secreto -->", "test")).toBe(
      "<p>a</p>",
    );
  });

  it("elimina svg y math (puente para XSS en algunos parsers)", () => {
    const clean = sanitizeRichText(
      "<p>a</p><svg><script>alert(1)</script></svg><math><mtext><script>alert(2)</script></mtext></math>",
      "test",
    );

    expect(clean).toBe("<p>a</p>");
    expect(clean).not.toContain("alert");
  });

  it("no toca valores que no son HTML", () => {
    expect(sanitizeRichText("solo texto", "test")).toBe("solo texto");
  });

  it("preserva null y vacío", () => {
    expect(sanitizeRichText(null, "test")).toBeNull();
    expect(sanitizeRichText("", "test")).toBe("");
  });

  it("preserva undefined como undefined, no como null", () => {
    // En un update de Prisma `undefined` significa "no tocar el campo" y
    // `null` significa "vaciarlo". Si esto devolviera null, un PATCH que no
    // manda el campo lo borraria igual.
    const result = sanitizeRichText(undefined, "test");

    expect(result).toBeUndefined();
    expect(result).not.toBeNull();
  });

  it("no convierte una cadena en null al sanitizar", () => {
    expect(sanitizeRichText("<p>x</p><script>y</script>", "test")).toBe(
      "<p>x</p>",
    );
  });

  it("trunca HTML gigante en vez de guardarlo entero", () => {
    const huge = `<p>${"a".repeat(300_000)}</p>`;

    const clean = sanitizeRichText(huge, "test");

    // El límite se aplica a la entrada; el parser puede agregar los tags de
    // cierre de lo que quedó truncado, así que el margen es pequeño.
    expect(clean).not.toBeNull();
    expect(clean!.length).toBeLessThanOrEqual(MAX_HTML_LENGTH + 1024);
    expect(clean!.length).toBeLessThan(huge.length);
  });

  it("no rompe un payload con anidamiento profundo", () => {
    const deep = "<div>".repeat(500) + "x" + "</div>".repeat(500);

    const clean = sanitizeRichText(deep, "test");

    expect(clean).toContain("x");
  });
});
