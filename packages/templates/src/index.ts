export { MinimalTemplate } from "./templates/MinimalTemplate";
export { CorporateTemplate } from "./templates/CorporateTemplate";
export { EditorialTemplate } from "./templates/EditorialTemplate";
export { CartaTemplate } from "./templates/CartaTemplate";
export { InformeTemplate } from "./templates/InformeTemplate";
export { DOCUMENT_TEMPLATES, TEMPLATE_COMPONENTS } from "./templates/registry";
export type { DocumentTemplateEntry } from "./templates/registry";
export {
  CARTA_TEMPLATE,
  CORPORATE_TEMPLATE,
  EDITORIAL_TEMPLATE,
  INFORME_TEMPLATE,
  MINIMAL_TEMPLATE,
  TEMPLATES,
  TEMPLATE_BY_ID,
} from "./render/config";
export { prepareBlocks } from "./render/prepare";
export type { TocEntry } from "./render/prepare";
export {
  parseMarkdown,
  parseDocument,
  hasMetadata,
  parseFrontMatter,
} from "./markdown";
export type { DocumentMetadata } from "./markdown";
export type { DocumentSectionType } from "./parser";
export { DEFAULT_ACCENT_COLOR, FONT_SIZE_SCALES } from "./theme";
export type {
  Block,
  DocumentModel,
  Inline,
  ListItem,
  MarkdownMode,
  TableAlignment,
} from "./markdown";
export type {
  FooterVariant,
  HeaderVariant,
  PdfTemplate,
  TemplateId,
  TemplateLayout,
  TemplateTheme,
} from "./render/config";
export type {
  DocumentTemplateProps,
  FontSizeOption,
  MarginOption,
} from "./types";
