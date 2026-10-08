export { MinimalTemplate } from "./templates/MinimalTemplate";
export { CorporateTemplate } from "./templates/CorporateTemplate";
export { CORPORATE_TEMPLATE, MINIMAL_TEMPLATE } from "./render/config";
export { DocumentBody, groupSections } from "./DocumentBody";
export { DocumentFooter, DocumentHeader } from "./DocumentChrome";
export { parseMarkdown, classifyLine } from "./parser";
export { parseDocument } from "./markdown";
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
  Block,
  DocumentModel,
  Inline,
  ListItem,
  MarkdownMode,
  TableAlignment,
} from "./markdown";
export type {
  HeaderVariant,
  TemplateDefinition,
  TemplateLayout,
} from "./render/config";
export type {
  DocumentTemplateProps,
  FontSizeOption,
  MarginOption,
} from "./types";
