import { CORPORATE_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";
import type { DocumentTemplateProps } from "../types";

export function CorporateTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, CORPORATE_TEMPLATE);
}

export default CorporateTemplate;
