import type { StyleSheet } from "@react-pdf/renderer";

type PdfStyles = ReturnType<typeof StyleSheet.create>;

export type PdfStyle = PdfStyles[string];
