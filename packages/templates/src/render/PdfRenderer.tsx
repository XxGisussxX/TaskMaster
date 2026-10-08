import { Document, Page, Text, View } from "@react-pdf/renderer";
import { registerDocumentFonts, resetDocumentFontGlyphCaches } from "../fonts";
import type { Block, DocumentMetadata } from "../markdown";
import type { DocumentTheme } from "../theme/tokens";
import { Blocks } from "./blocks";
import type { PdfTemplate } from "./config";
import { DocumentCover } from "./cover";
import { DocumentLetter } from "./letter";
import type { TocEntry } from "./prepare";
import type { TemplateStyles } from "./styles";
import { createTemplateStyles } from "./styles";
import { DocumentToc } from "./toc";

export interface PdfRendererProps {
  template: PdfTemplate;
  theme: DocumentTheme;
  blocks: Block[];
  toc: TocEntry[];
  documentTitle: string;
  metadata?: DocumentMetadata;
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
  template,
  theme,
  blocks,
  toc,
  documentTitle,
  metadata,
  showTitleOnFirstPage,
  dateLabel,
}: PdfRendererProps) {
  registerDocumentFonts();
  resetDocumentFontGlyphCaches();
  const { layout } = template;
  const styles: TemplateStyles = createTemplateStyles(theme, layout);
  const headerVariant = layout.header;
  const hasCover = layout.cover;

  return (
    <Document title={documentTitle}>
      {hasCover && (
        <Page size="A4" style={styles.page}>
          <DocumentCover
            title={documentTitle}
            subtitle={metadata?.subtitle}
            author={metadata?.author}
            dateLabel={dateLabel}
            kicker={template.label}
            styles={styles}
          />
        </Page>
      )}
      {layout.toc && toc.length > 0 && (
        <Page size="A4" style={styles.page}>
          <DocumentToc entries={toc} styles={styles} />
        </Page>
      )}
      <Page size="A4" style={styles.page}>
        {headerVariant !== null && (
          <View
            fixed
            render={({ pageNumber }) =>
              pageNumber >= layout.headerFromPage ||
              (!hasCover && showTitleOnFirstPage && pageNumber === 1) ? (
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
        {layout.letterBlock && (
          <DocumentLetter
            metadata={metadata}
            dateLabel={dateLabel}
            styles={styles}
          />
        )}
        <Blocks blocks={blocks} ctx={{ theme, styles, layout, depth: 0 }} />
        {layout.footer !== null && (
          <View fixed style={styles.footer}>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                layout.footer === "page"
                  ? `P\u00e1gina ${pageNumber}`
                  : `P\u00e1gina ${pageNumber} de ${totalPages}`
              }
            />
            {layout.footer === "page-date" && (
              <Text style={styles.footerText}>{dateLabel}</Text>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
