import { MINIMAL_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";
import type { DocumentTemplateProps } from "../types";

export function MinimalTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, MINIMAL_TEMPLATE);
}

export default MinimalTemplate;
