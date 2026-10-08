import { Link, Text, View } from "@react-pdf/renderer";
import type { TocEntry } from "./prepare";
import type { TemplateStyles } from "./styles";

export interface TocProps {
  entries: TocEntry[];
  styles: TemplateStyles;
  title?: string;
}

/**
 * Índice opcional (Fase 4) con enlaces internos a H1/H2. Los números de página
 * no son viables en una sola pasada de react-pdf, por lo que se enlaza sin
 * paginación (limitación documentada).
 */
export function DocumentToc({ entries, styles, title = "Índice" }: TocProps) {
  return (
    <View style={styles.toc}>
      <Text style={styles.tocTitle}>{title}</Text>
      {entries.map((entry) => (
        <View
          key={entry.id}
          style={
            entry.level === 2
              ? [styles.tocItem, styles.tocItemLevel2]
              : styles.tocItem
          }
        >
          <Text style={styles.tocBullet}>
            {entry.level === 1 ? "\u2022" : "\u25e6"}
          </Text>
          <Link src={`#${entry.id}`} style={styles.tocLink}>
            <Text style={styles.tocText}>{entry.title}</Text>
          </Link>
        </View>
      ))}
    </View>
  );
}
