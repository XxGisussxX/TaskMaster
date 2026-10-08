import { EDITORIAL_TEMPLATE } from "../render/config";
import { renderTemplate } from "../render/renderTemplate";
import type { DocumentTemplateProps } from "../types";

export function EditorialTemplate(props: DocumentTemplateProps) {
  return renderTemplate(props, EDITORIAL_TEMPLATE);
}

export default EditorialTemplate;
