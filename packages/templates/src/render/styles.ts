import { StyleSheet } from "@react-pdf/renderer";
import type { PdfStyle } from "../pdf-style";
import type { DocumentTheme } from "../theme/tokens";
import type { TemplateLayout } from "./config";

/**
 * Hoja de estilos del motor (Fase 3): TODO valor visual deriva de
 * DocumentTheme + TemplateLayout. No hay colores, tamaños ni espaciados
 * codificados en los componentes de render. La creación se memoiza por
 * (theme, layout) para conservar instancias estables entre renderizados.
 */
export interface TemplateStyles {
  page: PdfStyle;
  h1: PdfStyle;
  h2: PdfStyle;
  h3: PdfStyle;
  h4: PdfStyle;
  paragraph: PdfStyle;
  list: PdfStyle;
  listItem: PdfStyle;
  markerColumn: PdfStyle;
  marker: PdfStyle;
  markerAccent: PdfStyle;
  markerNumber: PdfStyle;
  itemContent: PdfStyle;
  table: PdfStyle;
  row: PdfStyle;
  rowHeader: PdfStyle;
  rowZebra: PdfStyle;
  cell: PdfStyle;
  cellText: PdfStyle;
  cellTextHeader: PdfStyle;
  cellTextFilled: PdfStyle;
  cellTextRight: PdfStyle;
  cellTextCenter: PdfStyle;
  codeBlock: PdfStyle;
  codeText: PdfStyle;
  quote: PdfStyle;
  separator: PdfStyle;
  link: PdfStyle;
  inlineCode: PdfStyle;
  image: PdfStyle;
  header: PdfStyle;
  logo: PdfStyle;
  logoText: PdfStyle;
  headerTitle: PdfStyle;
  footer: PdfStyle;
  footerText: PdfStyle;
}

const cache = new Map<string, TemplateStyles>();

export function createTemplateStyles(
  theme: DocumentTheme,
  layout: TemplateLayout,
): TemplateStyles {
  const key = JSON.stringify({ theme, layout });
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const { colors, fonts, sizes, lineHeights, spacing, margin } = theme;
  const rule = layout.h1RuleColor === "accent" ? colors.accent : colors.border;
  const h1Rule = layout.h1Rule
    ? {
        borderBottomWidth: 1,
        borderBottomStyle: "solid" as const,
        borderBottomColor: rule,
      }
    : {};
  const quoteBackground = layout.quoteBg
    ? { backgroundColor: colors.quoteBg }
    : {};

  const styles = StyleSheet.create({
    page: {
      paddingTop: margin,
      paddingHorizontal: margin,
      paddingBottom: margin + 16,
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
      color: colors.text,
    },
    h1: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h1,
      lineHeight: lineHeights.heading,
      textAlign: layout.h1Align,
      color: layout.h1Accent ? colors.accent : colors.text,
      ...h1Rule,
      paddingBottom: spacing.sm,
      marginTop: spacing.blockBefore,
      marginBottom: spacing.blockAfter,
    },
    h2: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h2,
      lineHeight: lineHeights.heading,
      color: layout.h2Accent ? colors.accent : colors.text,
      marginTop: spacing.blockBefore,
      marginBottom: spacing.blockAfter,
    },
    h3: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h3,
      lineHeight: lineHeights.heading,
      color: colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    h4: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h4,
      lineHeight: lineHeights.heading,
      color: colors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    paragraph: {
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
      marginBottom: spacing.blockAfter,
      textAlign: layout.paragraphAlign,
    },
    list: {
      marginLeft: spacing.md,
      marginBottom: spacing.blockAfter,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    markerColumn: {
      width: 18,
    },
    marker: {
      fontFamily: fonts.heading,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
    },
    markerAccent: {
      color: colors.accent,
    },
    markerNumber: {
      fontWeight: "bold",
      textAlign: "right",
      paddingRight: 3,
    },
    itemContent: {
      flex: 1,
      minWidth: 0,
    },
    table: {
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: colors.border,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    rowHeader: {
      backgroundColor:
        layout.tableHeaderFill === "accent" ? colors.accent : "transparent",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowZebra: {
      backgroundColor: colors.zebra,
    },
    cell: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      flex: 1,
      minWidth: 0,
    },
    cellText: {
      fontFamily: fonts.body,
      fontSize: sizes.small,
      lineHeight: lineHeights.table,
    },
    cellTextHeader: {
      fontWeight: "bold",
    },
    cellTextFilled: {
      color: colors.surface,
    },
    cellTextRight: {
      textAlign: "right",
    },
    cellTextCenter: {
      textAlign: "center",
    },
    codeBlock: {
      backgroundColor: colors.codeBg,
      borderLeftWidth: layout.codeBar ? 3 : 0,
      borderLeftColor: colors.accent,
      paddingVertical: spacing.sm,
      paddingHorizontal: 12,
      marginBottom: spacing.blockAfter,
    },
    codeText: {
      fontFamily: fonts.mono,
      fontSize: sizes.small,
      lineHeight: lineHeights.code,
      color: colors.text,
    },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor:
        layout.quoteBarColor === "accent" ? colors.accent : colors.border,
      paddingLeft: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.blockAfter,
      ...quoteBackground,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    link: {
      color: colors.accent,
      textDecoration: "underline",
    },
    inlineCode: {
      fontFamily: fonts.mono,
      backgroundColor: colors.codeBg,
      borderRadius: 2,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    image: {
      maxWidth: "100%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 12,
      marginBottom: 24,
      borderBottomWidth: layout.header === "brand" ? 2 : 1,
      borderBottomStyle: "solid",
      borderBottomColor:
        layout.header === "brand" ? colors.accent : colors.border,
    },
    logo: {
      width: layout.header === "brand" ? 28 : 26,
      height: layout.header === "brand" ? 28 : 26,
      borderRadius: 4,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginRight: layout.header === "brand" ? 10 : 8,
    },
    logoText: {
      fontFamily: fonts.heading,
      color: colors.surface,
      fontSize: layout.header === "brand" ? 13 : 12,
      lineHeight: 1.4,
      fontWeight: "bold",
    },
    headerTitle:
      layout.header === "brand"
        ? ({
            fontFamily: fonts.heading,
            fontWeight: "bold",
            fontSize: 10,
            lineHeight: 1.4,
            color: colors.accent,
            textTransform: "uppercase",
          } as PdfStyle)
        : ({
            fontSize: 10,
            lineHeight: 1.4,
            color: colors.muted,
          } as PdfStyle),
    footer: {
      position: "absolute",
      bottom: margin / 2,
      left: margin,
      right: margin,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: colors.border,
    },
    footerText: {
      fontFamily: fonts.body,
      fontSize: sizes.small,
      lineHeight: 1.4,
      color: colors.muted,
    },
  }) as unknown as TemplateStyles;

  cache.set(key, styles);
  return styles;
}
