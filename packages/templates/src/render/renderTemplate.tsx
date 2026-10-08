import { parseMarkdown } from "../markdown";
import { createDocumentTheme } from "../theme/tokens";
import { formatDocumentDate } from "../theme";
import type { DocumentTemplateProps } from "../types";
import type { TemplateDefinition } from "./config";
import { PdfRenderer } from "./PdfRenderer";

/**
 * Punto de entrada de las plantillas: convierte props de UI en model + tema
 * y delega la composición en PdfRenderer. Componente puro sin hooks (la API
 * lo invoca como función directa).
 */
export function renderTemplate(
  props: DocumentTemplateProps,
  definition: TemplateDefinition,
) {
  const model = parseMarkdown(props.content);
  const explicitTitle = props.title?.trim() ?? "";
  const documentTitle =
    explicitTitle || model.title || definition.fallbackTitle;
  const theme = createDocumentTheme({
    accentColor: props.accentColor ?? definition.defaultAccent,
    margin: props.margin,
    fontSize: props.fontSize,
  });

  return (
    <PdfRenderer
      model={model}
      theme={theme}
      definition={definition}
      documentTitle={documentTitle}
      showTitleOnFirstPage={explicitTitle.length > 0}
      dateLabel={formatDocumentDate(props.generatedAt ?? new Date())}
    />
  );
}
