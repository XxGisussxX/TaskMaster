import { CARTA_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";
import type { DocumentTemplateProps } from "../types";

export function CartaTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, CARTA_TEMPLATE);
}

export default CartaTemplate;
