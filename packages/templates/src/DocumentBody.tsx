import { Text, View } from "@react-pdf/renderer";
import type { PdfStyle } from "./pdf-style";
import type { DocumentSection } from "./parser";

const NUMBERED_PATTERN = /^(\d+\.)\s+(\S.*)$/;

export interface DocumentBodyStyles {
  block: PdfStyle;
  h1: PdfStyle;
  h2: PdfStyle;
  paragraph: PdfStyle;
  list: PdfStyle;
  marker: PdfStyle;
  number: PdfStyle;
  separator: PdfStyle;
}

export interface DocumentBodyProps {
  sections: DocumentSection[];
  styles: DocumentBodyStyles;
}

export interface DocumentBlock {
  id: string;
  sections: DocumentSection[];
}

export function groupSections(sections: DocumentSection[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let current: DocumentSection[] = [];

  for (const section of sections) {
    const startsBlock =
      section.type === "heading" || section.type === "heading-2";

    if (startsBlock && current.length > 0) {
      blocks.push({ id: blocks.length.toString(), sections: current });
      current = [];
    }

    current.push(section);
  }

  if (current.length > 0) {
    blocks.push({ id: blocks.length.toString(), sections: current });
  }

  return blocks;
}

function renderSection(
  section: DocumentSection,
  styles: DocumentBodyStyles,
  key: string,
) {
  if (section.type === "heading") {
    return (
      <Text key={key} style={styles.h1}>
        {section.content}
      </Text>
    );
  }

  if (section.type === "heading-2") {
    return (
      <Text key={key} style={styles.h2}>
        {section.content}
      </Text>
    );
  }

  if (section.type === "list-item") {
    return (
      <Text key={key} style={styles.list}>
        <Text style={styles.marker}>{"\u2022 "}</Text>
        {section.content}
      </Text>
    );
  }

  if (section.type === "numbered-item") {
    const [, number = "", content = ""] =
      section.content.match(NUMBERED_PATTERN) ?? [];

    return (
      <Text key={key} style={styles.list}>
        <Text style={styles.number}>{`${number}  `}</Text>
        {content}
      </Text>
    );
  }

  return (
    <Text key={key} style={styles.paragraph}>
      {section.content}
    </Text>
  );
}

export function DocumentBody({ sections, styles }: DocumentBodyProps) {
  const blocks = groupSections(sections);

  return (
    <>
      {blocks.map((block, blockIndex) => (
        <View key={block.id} style={styles.block}>
          {block.sections.map((section, sectionIndex) =>
            renderSection(section, styles, `${block.id}-${sectionIndex}`),
          )}
          {blockIndex < blocks.length - 1 ? (
            <View style={styles.separator} />
          ) : null}
        </View>
      ))}
    </>
  );
}

export default DocumentBody;
