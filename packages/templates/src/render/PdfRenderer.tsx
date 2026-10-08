import { Document, Page, Text, View } from "@react-pdf/renderer";
import { registerDocumentFonts, resetDocumentFontGlyphCaches } from "../fonts";
import type { DocumentModel } from "../markdown";
import type { DocumentTheme } from "../theme/tokens";
import { Blocks } from "./blocks";
import type { TemplateDefinition } from "./config";
import type { TemplateStyles } from "./styles";
import { createTemplateStyles } from "./styles";

export interface PdfRendererProps {
  model: DocumentModel;
  theme: DocumentTheme;
  definition: TemplateDefinition;
  documentTitle: string;
  /** true cuando el título viene de prop explícita (se muestra también en la página 1). */
  showTitleOnFirstPage: boolean;
  dateLabel: string;
}

function monogramOf(title: string): string {
  return (title.trim()[0] ?? "D").toUpperCase();
}

/**
 * Compone el PDF definitivo: DocumentModel + DocumentTheme + TemplateLayout.
 * Componente puro sin hooks: la API invoca las plantillas como funciones
 * directas, por lo que toda la preparación (registro de fuentes, estilos)
 * ocurre síncronamente en el cuerpo.
 */
export function PdfRenderer({
  model,
  theme,
  definition,
  documentTitle,
  showTitleOnFirstPage,
  dateLabel,
}: PdfRendererProps) {
  registerDocumentFonts();
  resetDocumentFontGlyphCaches();
  const styles: TemplateStyles = createTemplateStyles(theme, definition.layout);
  const headerVariant = definition.layout.header;

  return (
    <Document title={documentTitle}>
      <Page size="A4" style={styles.page}>
        {headerVariant !== null && (
          <View
            fixed
            render={({ pageNumber }) =>
              pageNumber > 1 || showTitleOnFirstPage ? (
                <View style={styles.header}>
                  <View style={styles.logo}>
                    <Text style={styles.logoText}>
                      {monogramOf(documentTitle)}
                    </Text>
                  </View>
                  <Text style={styles.headerTitle}>{documentTitle}</Text>
                </View>
              ) : null
            }
          />
        )}
        <Blocks
          blocks={model.blocks}
          ctx={{ theme, styles, layout: definition.layout, depth: 0 }}
        />
        <View fixed style={styles.footer}>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `P\u00e1gina ${pageNumber} de ${totalPages}`
            }
          />
          <Text style={styles.footerText}>{dateLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
