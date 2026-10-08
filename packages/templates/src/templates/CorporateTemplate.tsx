import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { DocumentBody } from "../DocumentBody";
import type { DocumentBodyStyles } from "../DocumentBody";
import { DocumentFooter, DocumentHeader } from "../DocumentChrome";
import type { DocumentChromeStyles } from "../DocumentChrome";
import type { PdfStyle } from "../pdf-style";
import { parseMarkdown } from "../parser";
import {
  DEFAULT_ACCENT_COLOR,
  formatDocumentDate,
  resolveTheme,
} from "../theme";
import type { DocumentTemplateProps } from "../types";

const DEFAULT_TITLE = "Corporate Document";

const cache = new Map<string, CorporateStyles>();

export interface CorporateStyles
  extends DocumentBodyStyles, DocumentChromeStyles {
  page: PdfStyle;
}

export function resolveStyles({
  fontSize,
  margin,
  accentColor,
}: Partial<DocumentTemplateProps> = {}): CorporateStyles {
  const theme = resolveTheme({
    fontSize,
    margin,
    accentColor,
    defaultAccent: DEFAULT_ACCENT_COLOR,
  });
  const key = `${theme.accent}-${theme.fontSize}-${theme.padding}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const muted = "#374151";
  const faint = "#6b7280";
  const rule = "#d1d5db";
  const lightRule = "#e5e7eb";

  const styles = StyleSheet.create({
    page: {
      paddingTop: theme.padding,
      paddingHorizontal: theme.padding,
      paddingBottom: theme.padding + 16,
      fontFamily: "Helvetica",
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: muted,
    },
    block: {
      marginBottom: 20,
    },
    h1: {
      fontFamily: "Helvetica",
      fontWeight: "bold",
      fontSize: theme.headingFontSize,
      lineHeight: 1.2,
      textAlign: "center",
      color: theme.accent,
      borderBottomWidth: 1,
      borderBottomStyle: "solid",
      borderBottomColor: theme.accent,
      paddingBottom: 8,
      marginBottom: 20,
    },
    h2: {
      fontFamily: "Helvetica",
      fontWeight: "bold",
      fontSize: theme.subheadingFontSize,
      color: theme.accent,
      marginTop: 16,
      marginBottom: 8,
    },
    paragraph: {
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      marginBottom: 12,
      whiteSpace: "pre-wrap",
      textAlign: "justify",
    },
    list: {
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      marginLeft: 20,
      marginBottom: 8,
    },
    marker: {
      color: theme.accent,
    },
    number: {
      fontWeight: "bold",
      color: theme.accent,
    },
    separator: {
      height: 1,
      backgroundColor: lightRule,
      marginTop: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 12,
      marginBottom: 24,
      borderBottomWidth: 2,
      borderBottomStyle: "solid",
      borderBottomColor: theme.accent,
    },
    logo: {
      width: 28,
      height: 28,
      borderRadius: 4,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    logoText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "bold",
    },
    headerTitle: {
      fontFamily: "Helvetica",
      fontWeight: "bold",
      fontSize: 10,
      color: theme.accent,
      textTransform: "uppercase",
    },
    footer: {
      position: "absolute",
      bottom: theme.padding / 2,
      left: theme.padding,
      right: theme.padding,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: rule,
    },
    footerText: {
      fontSize: 9,
      color: faint,
    },
  }) as CorporateStyles;

  cache.set(key, styles);
  return styles;
}

export function CorporateTemplate({
  content,
  fontSize,
  margin,
  accentColor,
  title,
  generatedAt,
}: DocumentTemplateProps) {
  const styles = resolveStyles({ fontSize, margin, accentColor });
  const sections = parseMarkdown(content, { subheadings: true });
  const firstHeading = sections.find(
    (section) => section.type === "heading" || section.type === "heading-2",
  );
  const documentTitle = title?.trim() || firstHeading?.content || DEFAULT_TITLE;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <DocumentHeader title={documentTitle} styles={styles} />
        <DocumentBody sections={sections} styles={styles} />
        <DocumentFooter
          dateLabel={formatDocumentDate(generatedAt ?? new Date())}
          styles={styles}
        />
      </Page>
    </Document>
  );
}

export default CorporateTemplate;
