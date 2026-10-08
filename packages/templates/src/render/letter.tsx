import { Text, View } from "@react-pdf/renderer";
import type { DocumentMetadata } from "../markdown";
import type { TemplateStyles } from "./styles";

export interface LetterProps {
  metadata?: DocumentMetadata;
  dateLabel: string;
  styles: TemplateStyles;
}

/**
 * Bloque epistolar (Fase 4, plantilla Carta): remitente, fecha, destinatario y
 * asunto. Los campos llegan por front-matter; la fecha cae al valor generado.
 */
export function DocumentLetter({ metadata, dateLabel, styles }: LetterProps) {
  const date = metadata?.date?.trim() || dateLabel;
  const to = metadata?.to?.trim();
  const from = metadata?.from?.trim();
  const subject = metadata?.subject?.trim();
  return (
    <View style={styles.letter}>
      {from ? <Text style={styles.letterFrom}>{from}</Text> : null}
      <Text style={styles.letterMeta}>{date}</Text>
      {to ? (
        <Text style={styles.letterMeta}>
          <Text style={styles.letterLabel}>Para: </Text>
          {to}
        </Text>
      ) : null}
      {subject ? (
        <Text style={styles.letterSubject}>
          <Text style={styles.letterLabel}>Asunto: </Text>
          {subject}
        </Text>
      ) : null}
    </View>
  );
}
