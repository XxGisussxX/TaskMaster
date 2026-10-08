import { parseMarkdown } from "../markdown";
import { createDocumentTheme } from "../theme/tokens";
import { formatDocumentDate } from "../theme";
import type { DocumentTemplateProps } from "../types";
import type { PdfTemplate } from "./config";
import { PdfRenderer } from "./PdfRenderer";
import { prepareBlocks } from "./prepare";

/**
 * Punto de entrada de las plantillas: convierte props de UI en model + tema
 * y delega la composición en PdfRenderer. Componente puro sin hooks (la API
 * lo invoca como función directa).
 */
export function renderTemplate(
  props: DocumentTemplateProps,
  template: PdfTemplate,
) {
  const model = parseMarkdown(props.content);
  const metadata = model.metadata;
  const explicitTitle = props.title?.trim() ?? "";
  const documentTitle =
    explicitTitle ||
    metadata?.title?.trim() ||
    model.title ||
    template.fallbackTitle;
  const theme = createDocumentTheme({
    accentColor: props.accentColor ?? template.theme.accent,
    margin: props.margin,
    fontSize: props.fontSize,
    bodyFont: template.theme.bodyFont,
    headingFont: template.theme.headingFont,
    density: template.theme.density,
    headingScale: template.theme.headingScale,
  });
  const { blocks, toc } = prepareBlocks(model.blocks, {
    numbering: template.layout.sectionNumbering,
    dropCap: template.layout.dropCap,
    toc: template.layout.toc,
  });

  return (
    <PdfRenderer
      template={template}
      theme={theme}
      blocks={blocks}
      toc={toc}
      documentTitle={documentTitle}
      metadata={metadata}
      showTitleOnFirstPage={explicitTitle.length > 0}
      dateLabel={formatDocumentDate(props.generatedAt ?? new Date())}
    />
  );
}
