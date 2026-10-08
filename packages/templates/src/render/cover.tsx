import { Text, View } from "@react-pdf/renderer";
import type { TemplateStyles } from "./styles";

export interface CoverProps {
  title: string;
  subtitle?: string;
  author?: string;
  dateLabel: string;
  kicker?: string;
  styles: TemplateStyles;
}

/** Portada opcional (Fase 4): primera página centrada con filete de acento. */
export function DocumentCover({
  title,
  subtitle,
  author,
  dateLabel,
  kicker,
  styles,
}: CoverProps) {
  const meta = [author, dateLabel]
    .filter((value): value is string => Boolean(value))
    .join("  ·  ");
  return (
    <View style={styles.cover}>
      <View style={styles.coverInner}>
        {kicker ? <Text style={styles.coverKicker}>{kicker}</Text> : null}
        <Text style={styles.coverTitle}>{title}</Text>
        {subtitle ? <Text style={styles.coverSubtitle}>{subtitle}</Text> : null}
        <View style={styles.coverRule} />
        {meta ? <Text style={styles.coverMeta}>{meta}</Text> : null}
      </View>
    </View>
  );
}
