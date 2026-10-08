import { Fragment } from "react";
import { Image, Link, Text } from "@react-pdf/renderer";
import type { Inline } from "../markdown";
import { stripUnsupportedText } from "../text/sanitize";
import type { TemplateStyles } from "./styles";

/**
 * Parte palabras/tokens más largos que una línea en trozos de a react-pdf
 * pueda envolver (sin guion visible). Los tokens de ≤ 24 caracteres nunca
 * superan una línea con el cuerpo tipográfico del tema, por lo que devolver
 * la palabra entera es un no-op seguro aunque el motor invoque al callback
 * en todos los casos.
 */
export function breakLongWords(word: string): string[] {
  if (word.length <= 24) {
    return [word];
  }
  const parts: string[] = [];
  for (let index = 0; index < word.length; index += 24) {
    parts.push(word.slice(index, index + 24));
  }
  return parts;
}

/**
 * Prepara un bloque de código para render: los tabuladores se expanden a
 * 4 espacios y los espacios iniciales de cada línea se convierten en
 * espacios no separables (U+00A0). react-pdf NO indenta visualmente los
 * espacios/tabuladores iniciales (cae en el margen de la línea), mientras
 * que el NBSP sí conserva el avance. Los espacios intermedios se mantienen
 * como espacios normales para conservar los puntos de quiebre de línea.
 */
export function prepareCode(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const expanded = line.replace(/\t/g, "    ");
      const leading = /^[ ]*/.exec(expanded)?.[0] ?? "";
      if (!leading) {
        return expanded;
      }
      return "\u00a0".repeat(leading.length) + expanded.slice(leading.length);
    })
    .join("\n");
}

interface InlinesProps {
  nodes: Inline[];
  styles: TemplateStyles;
}

/**
 * Renderiza nodos inline (texto saneado, negrita, cursiva, código en línea,
 * enlaces e imágenes) como hijos de un Text.
 */
export function Inlines({ nodes, styles }: InlinesProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={index}>{renderInline(node, styles)}</Fragment>
      ))}
    </>
  );
}

function renderInline(node: Inline, styles: TemplateStyles) {
  switch (node.type) {
    case "text":
      return stripUnsupportedText(node.value);
    case "bold":
      return (
        <Text style={{ fontWeight: "bold" }}>
          <Inlines nodes={node.children} styles={styles} />
        </Text>
      );
    case "italic":
      return (
        <Text style={{ fontStyle: "italic" }}>
          <Inlines nodes={node.children} styles={styles} />
        </Text>
      );
    case "code":
      return (
        <Text style={styles.inlineCode}>
          {stripUnsupportedText(node.value)}
        </Text>
      );
    case "link":
      return (
        <Link src={node.url} style={styles.link}>
          <Inlines nodes={node.children} styles={styles} />
        </Link>
      );
    case "image":
      return <Image src={node.url} style={styles.image} />;
    default:
      return null;
  }
}
