import { Text, View } from "@react-pdf/renderer";
import type {
  Block,
  Inline,
  TableAlignment,
  TableRow,
} from "../markdown/model";
import { stripUnsupportedText } from "../text/sanitize";
import type { DocumentTheme } from "../theme/tokens";
import type { TemplateLayout } from "./config";
import { breakLongWords, Inlines, prepareCode } from "./text";
import type { TemplateStyles } from "./styles";

export interface BlockContext {
  theme: DocumentTheme;
  styles: TemplateStyles;
  layout: TemplateLayout;
  /** Nivel de anidamiento de listas (para el glifo de viñeta). */
  depth: number;
}

/** Espacio mínimo bajo un titular para no dejarlo huérfano al final de página. */
const HEADING_MIN_PRESENCE: Record<number, number> = {
  1: 96,
  2: 72,
  3: 56,
  4: 48,
};

const BULLETS = ["\u2022", "\u25e6", "\u25aa"];
const TAIL_ZERO = { marginBottom: 0 } as const;
const NUMERIC_CELL = /^[+-]?[\d.,\s%$€]+$/;

interface BlocksProps {
  blocks: Block[];
  ctx: BlockContext;
  /** Indica que los bloques viven dentro de un contenedor (ítem de lista,
   * cita): el último hijo no lleva margen inferior porque el contenedor ya
   * aporta el separador. */
  contained?: boolean;
}

export function Blocks({ blocks, ctx, contained }: BlocksProps) {
  return (
    <>
      {blocks.map((block, index) => {
        const tail = contained === true && index === blocks.length - 1;
        return <BlockNode key={index} block={block} ctx={ctx} tail={tail} />;
      })}
    </>
  );
}

function BlockNode({
  block,
  ctx,
  tail,
}: {
  block: Block;
  ctx: BlockContext;
  tail: boolean;
}) {
  const { styles } = ctx;

  switch (block.type) {
    case "heading": {
      const style =
        block.level === 1
          ? styles.h1
          : block.level === 2
            ? styles.h2
            : block.level === 3
              ? styles.h3
              : styles.h4;
      return (
        <Text
          id={block.id}
          style={style}
          minPresenceAhead={HEADING_MIN_PRESENCE[block.level]}
          hyphenationCallback={breakLongWords}
        >
          <Inlines nodes={block.children} styles={styles} />
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text
          style={tail ? [styles.paragraph, TAIL_ZERO] : styles.paragraph}
          orphans={2}
          widows={2}
          hyphenationCallback={breakLongWords}
        >
          <Inlines nodes={block.children} styles={styles} />
        </Text>
      );
    case "list":
      return <ListBlock block={block} ctx={ctx} tail={tail} />;
    case "table":
      return <TableBlock block={block} ctx={ctx} tail={tail} />;
    case "code":
      return (
        <View style={tail ? [styles.codeBlock, TAIL_ZERO] : styles.codeBlock}>
          <Text
            style={styles.codeText}
            hyphenationCallback={breakLongWords}
            wrap
          >
            {stripUnsupportedText(prepareCode(block.value))}
          </Text>
        </View>
      );
    case "blockquote":
      return (
        <View style={tail ? [styles.quote, TAIL_ZERO] : styles.quote}>
          <Blocks blocks={block.children} ctx={ctx} contained />
        </View>
      );
    case "thematicBreak":
      return (
        <View style={tail ? [styles.separator, TAIL_ZERO] : styles.separator} />
      );
    default:
      return null;
  }
}

function ListBlock({
  block,
  ctx,
  tail,
}: {
  block: Extract<Block, { type: "list" }>;
  ctx: BlockContext;
  tail: boolean;
}) {
  const { styles, theme, layout } = ctx;
  const itemCtx: BlockContext = { ...ctx, depth: ctx.depth + 1 };

  return (
    <View style={tail ? [styles.list, TAIL_ZERO] : styles.list}>
      {block.items.map((item, index) => {
        const marker =
          item.checked !== undefined
            ? item.checked
              ? "\u2611"
              : "\u2610"
            : block.ordered
              ? `${block.start + index}.`
              : BULLETS[ctx.depth % BULLETS.length];
        const markerStyle = [
          styles.marker,
          layout.listMarkerAccent && item.checked === undefined
            ? styles.markerAccent
            : undefined,
          block.ordered ? styles.markerNumber : undefined,
        ];

        return (
          <View
            key={index}
            style={[
              styles.listItem,
              {
                marginBottom: block.tight ? theme.spacing.xs : theme.spacing.sm,
              },
            ]}
          >
            <View style={styles.markerColumn}>
              <Text style={markerStyle}>{marker}</Text>
            </View>
            <View style={styles.itemContent}>
              <Blocks blocks={item.children} ctx={itemCtx} contained />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TableBlock({
  block,
  ctx,
  tail,
}: {
  block: Extract<Block, { type: "table" }>;
  ctx: BlockContext;
  tail: boolean;
}) {
  const { styles, layout } = ctx;
  const filled = layout.tableHeaderFill === "accent";
  const alignments: TableAlignment[] = Array.from(
    { length: block.header.cells.length },
    (_, column) =>
      block.align[column] ??
      (isNumericColumn(block.rows, column) ? "right" : "left"),
  );
  const alignStyle = (alignment: TableAlignment | undefined) =>
    alignment === "right"
      ? styles.cellTextRight
      : alignment === "center"
        ? styles.cellTextCenter
        : undefined;

  return (
    <View style={tail ? [styles.table, TAIL_ZERO] : styles.table}>
      <View style={[styles.row, styles.rowHeader]} wrap={false}>
        {block.header.cells.map((cell, column) => (
          <View key={column} style={styles.cell}>
            <Text
              style={[
                styles.cellText,
                styles.cellTextHeader,
                filled ? styles.cellTextFilled : undefined,
                alignStyle(alignments[column]),
              ]}
              hyphenationCallback={breakLongWords}
            >
              <Inlines nodes={cell.inlines} styles={styles} />
            </Text>
          </View>
        ))}
      </View>
      {block.rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[
            styles.row,
            layout.tableZebra && rowIndex % 2 === 1
              ? styles.rowZebra
              : undefined,
          ]}
          wrap={false}
        >
          {row.cells.map((cell, column) => (
            <View key={column} style={styles.cell}>
              <Text
                style={[styles.cellText, alignStyle(alignments[column])]}
                hyphenationCallback={breakLongWords}
              >
                <Inlines nodes={cell.inlines} styles={styles} />
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Una columna es numérica cuando todas sus celdas (sin cabecera) parecen
 * números/monedas/porcentajes con al menos un dígito. Se usa para alinear a
 * la derecha cuando la alineación GFM no está explícita.
 */
export function isNumericColumn(rows: TableRow[], column: number): boolean {
  const values = rows
    .map((row) => {
      const inlines = row.cells[column]?.inlines;
      return inlines ? inlines.map(inlineValue).join("") : "";
    })
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return false;
  }
  return values.every((value) => NUMERIC_CELL.test(value) && /\d/.test(value));
}

function inlineValue(node: Inline): string {
  switch (node.type) {
    case "text":
    case "code":
      return node.value;
    case "image":
      return "";
    default:
      return node.children.map(inlineValue).join("");
  }
}
