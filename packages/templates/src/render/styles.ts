import { StyleSheet } from "@react-pdf/renderer";
import type { PdfStyle } from "../pdf-style";
import type { DocumentTheme } from "../theme/tokens";
import type { TemplateLayout } from "./config";

/**
 * Hoja de estilos del motor (Fase 3–4): TODO valor visual deriva de
 * DocumentTheme (fuente, tamaños, densidad) + TemplateLayout (composición).
 * No hay colores, tamaños ni espaciados codificados en los componentes de
 * render. La creación se memoiza por (theme, layout) para conservar instancias
 * estables entre renderizados.
 */
export interface TemplateStyles {
  page: PdfStyle;
  h1: PdfStyle;
  h2: PdfStyle;
  h3: PdfStyle;
  h4: PdfStyle;
  singleHeading: PdfStyle;
  headingNumber: PdfStyle;
  paragraph: PdfStyle;
  dropCap: PdfStyle;
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
  quoteLarge: PdfStyle;
  quoteLargeText: PdfStyle;
  separator: PdfStyle;
  link: PdfStyle;
  inlineCode: PdfStyle;
  image: PdfStyle;
  header: PdfStyle;
  logo: PdfStyle;
  logoText: PdfStyle;
  headerTitle: PdfStyle;
  headerSubtitle: PdfStyle;
  footer: PdfStyle;
  footerText: PdfStyle;
  cover: PdfStyle;
  coverInner: PdfStyle;
  coverKicker: PdfStyle;
  coverTitle: PdfStyle;
  coverSubtitle: PdfStyle;
  coverRule: PdfStyle;
  coverMeta: PdfStyle;
  toc: PdfStyle;
  tocTitle: PdfStyle;
  tocItem: PdfStyle;
  tocItemLevel2: PdfStyle;
  tocLink: PdfStyle;
  tocText: PdfStyle;
  tocBullet: PdfStyle;
  letter: PdfStyle;
  letterFrom: PdfStyle;
  letterMeta: PdfStyle;
  letterLabel: PdfStyle;
  letterSubject: PdfStyle;
  letterSpacer: PdfStyle;
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
  const h2Rule = layout.h2Rule
    ? {
        borderBottomWidth: 0.5,
        borderBottomStyle: "solid" as const,
        borderBottomColor: colors.border,
        paddingBottom: spacing.xs,
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
      ...h2Rule,
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
    singleHeading: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h4,
      lineHeight: lineHeights.heading,
      color: colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    headingNumber: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      color: colors.accent,
    },
    paragraph: {
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
      marginBottom: spacing.blockAfter,
      textAlign: layout.paragraphAlign,
    },
    dropCap: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.body * 2.6,
      lineHeight: 1,
      color: layout.h2Accent ? colors.accent : colors.text,
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
    quoteLarge: {
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      paddingLeft: spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    quoteLargeText: {
      fontFamily: fonts.heading,
      fontSize: sizes.h4,
      lineHeight: lineHeights.body,
      fontStyle: "italic",
      color: colors.text,
      marginBottom: 0,
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
    headerSubtitle: {
      fontFamily: fonts.heading,
      fontSize: 10,
      lineHeight: 1.4,
      color: colors.muted,
      marginTop: 2,
    },
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
    cover: {
      flex: 1,
      justifyContent: "center",
      paddingTop: margin,
      paddingHorizontal: margin * 1.3,
      paddingBottom: margin,
    },
    coverInner: {
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      paddingTop: spacing.lg,
    },
    coverKicker: {
      fontFamily: fonts.heading,
      fontSize: sizes.small,
      lineHeight: 1.4,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: colors.muted,
      marginBottom: spacing.sm,
    },
    coverTitle: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h1 * 1.5,
      lineHeight: 1.15,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    coverSubtitle: {
      fontFamily: fonts.body,
      fontSize: sizes.h3,
      lineHeight: 1.35,
      color: colors.muted,
      marginBottom: spacing.lg,
    },
    coverRule: {
      width: 64,
      height: 2,
      backgroundColor: colors.accent,
      marginBottom: spacing.lg,
    },
    coverMeta: {
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: 1.5,
      color: colors.text,
    },
    toc: {
      paddingTop: spacing.lg,
    },
    tocTitle: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h2,
      lineHeight: lineHeights.heading,
      color: layout.h1Accent ? colors.accent : colors.text,
      marginBottom: spacing.lg,
    },
    tocItem: {
      flexDirection: "row",
      marginBottom: spacing.sm,
    },
    tocItemLevel2: {
      paddingLeft: spacing.lg,
    },
    tocBullet: {
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
      color: colors.muted,
      width: 16,
    },
    tocLink: {
      color: colors.text,
      textDecoration: "none",
      flex: 1,
    },
    tocText: {
      fontFamily: fonts.heading,
      fontSize: sizes.body,
      lineHeight: lineHeights.body,
    },
    letter: {
      marginBottom: spacing.lg,
    },
    letterFrom: {
      fontFamily: fonts.heading,
      fontSize: sizes.body,
      lineHeight: 1.5,
      color: colors.text,
      marginBottom: spacing.md,
    },
    letterMeta: {
      fontFamily: fonts.body,
      fontSize: sizes.body,
      lineHeight: 1.5,
      color: colors.muted,
      marginBottom: spacing.xs,
    },
    letterLabel: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      color: colors.text,
    },
    letterSubject: {
      fontFamily: fonts.heading,
      fontWeight: "bold",
      fontSize: sizes.h4,
      lineHeight: lineHeights.heading,
      color: colors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    letterSpacer: {
      height: spacing.md,
    },
  }) as unknown as TemplateStyles;

  cache.set(key, styles);
  return styles;
}
