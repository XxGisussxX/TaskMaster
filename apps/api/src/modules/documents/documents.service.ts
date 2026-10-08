import { Injectable } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { CorporateTemplate, MinimalTemplate } from "@taskmaster/templates";
import type { DocumentTemplateProps } from "@taskmaster/templates";
import type {
  GenerateDocumentInput,
  DocumentTemplateType,
} from "@taskmaster/contracts";

const templateMap: Record<DocumentTemplateType, any> = {
  minimal: MinimalTemplate,
  corporate: CorporateTemplate,
};

@Injectable()
export class DocumentsService {
  async generatePdf({
    content,
    template,
    fontSize,
    margin,
    accentColor,
    title,
  }: GenerateDocumentInput): Promise<Buffer> {
    const TemplateComponent = templateMap[template];
    const props: DocumentTemplateProps = {
      content,
      fontSize,
      margin,
      accentColor,
      title,
    };
    const pdf = await renderToBuffer(TemplateComponent(props));
    return Buffer.from(pdf);
  }
}
