export { MinimalTemplate } from "./templates/MinimalTemplate";
export { CorporateTemplate } from "./templates/CorporateTemplate";
export { DocumentBody, groupSections } from "./DocumentBody";
export { DocumentFooter, DocumentHeader } from "./DocumentChrome";
export { parseMarkdown, classifyLine } from "./parser";
export {
  DEFAULT_ACCENT_COLOR,
  FONT_SIZE_SCALES,
  MARGIN_PADDINGS,
} from "./theme";
export type { DocumentBodyStyles } from "./DocumentBody";
export type { DocumentChromeStyles } from "./DocumentChrome";
export type {
  DocumentSection,
  DocumentSectionType,
  ParseOptions,
} from "./parser";
export type {
  DocumentTemplateProps,
  FontSizeOption,
  MarginOption,
} from "./types";
