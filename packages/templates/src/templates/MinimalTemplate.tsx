import { StyleSheet } from "@react-pdf/renderer";
import type { DocumentBodyStyles } from "../DocumentBody";
import type { DocumentChromeStyles } from "../DocumentChrome";
import type { PdfStyle } from "../pdf-style";
import { resolveTheme } from "../theme";
import type { DocumentTemplateProps } from "../types";
import { MINIMAL_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";

const DEFAULT_ACCENT = "#111827";

const cache = new Map<string, MinimalStyles>();

export interface MinimalStyles
  extends DocumentBodyStyles, DocumentChromeStyles {
  page: PdfStyle;
}

/**
 * @deprecated Estilos del motor legado (DocumentBody/DocumentChrome). Se
 * conserva mientras esas piezas no migren; el render real deriva de
 * createTemplateStyles (Fase 3).
 */
export function resolveStyles({
  fontSize,
  margin,
  accentColor,
}: Partial<DocumentTemplateProps> = {}): MinimalStyles {
  const theme = resolveTheme({
    fontSize,
    margin,
    accentColor,
    defaultAccent: DEFAULT_ACCENT,
  });
  const key = `${theme.accent}-${theme.fontSize}-${theme.padding}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const muted = "#4b5563";
  const faint = "#9ca3af";
  const rule = "#e5e7eb";

  const styles = StyleSheet.create({
    page: {
      paddingTop: theme.padding,
      paddingHorizontal: theme.padding,
      paddingBottom: theme.padding + 16,
      fontFamily: "Helvetica",
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: "#111827",
    },
    block: {
      marginBottom: 20,
    },
    h1: {
      fontFamily: "Times-Roman",
      fontWeight: "bold",
      fontSize: theme.headingFontSize,
      lineHeight: 1.2,
      textAlign: "center",
      borderBottomWidth: 1,
      borderBottomStyle: "solid",
      borderBottomColor: rule,
      paddingBottom: 8,
      marginBottom: 20,
    },
    h2: {
      fontFamily: "Times-Roman",
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
      backgroundColor: rule,
      marginTop: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 12,
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomStyle: "solid",
      borderBottomColor: rule,
    },
    logo: {
      width: 26,
      height: 26,
      borderRadius: 4,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    logoText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "bold",
    },
    headerTitle: {
      fontSize: 10,
      color: muted,
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
  }) as MinimalStyles;

  cache.set(key, styles);
  return styles;
}

export function MinimalTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, MINIMAL_TEMPLATE);
}

export default MinimalTemplate;
