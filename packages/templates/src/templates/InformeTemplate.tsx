import { INFORME_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";
import type { DocumentTemplateProps } from "../types";

export function InformeTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, INFORME_TEMPLATE);
}

export default InformeTemplate;
