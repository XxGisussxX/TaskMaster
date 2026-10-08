import { Text, View } from "@react-pdf/renderer";
import type { PdfStyle } from "./pdf-style";

export interface DocumentChromeStyles {
  header: PdfStyle;
  logo: PdfStyle;
  logoText: PdfStyle;
  headerTitle: PdfStyle;
  footer: PdfStyle;
  footerText: PdfStyle;
}

interface DocumentHeaderProps {
  title: string;
  styles: DocumentChromeStyles;
}

interface DocumentFooterProps {
  dateLabel: string;
  styles: DocumentChromeStyles;
}

function monogramOf(title: string): string {
  return (title.trim()[0] ?? "D").toUpperCase();
}

export function DocumentHeader({ title, styles }: DocumentHeaderProps) {
  return (
    <View fixed style={styles.header}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>{monogramOf(title)}</Text>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

export function DocumentFooter({ dateLabel, styles }: DocumentFooterProps) {
  return (
    <View fixed style={styles.footer}>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
      <Text style={styles.footerText}>{dateLabel}</Text>
    </View>
  );
}
