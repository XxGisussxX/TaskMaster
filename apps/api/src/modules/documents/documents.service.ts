import { Injectable, Logger, RequestTimeoutException } from "@nestjs/common";
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

/** El render react-pdf no puede cancelarse: un documento con muchos page breaks
 * puede tardar; pasados 15s se responde 408 y el request queda descartado. */
const PDF_RENDER_TIMEOUT_MS = 15_000;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

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
    const pdf = await this.withRenderTimeout(TemplateComponent(props));
    return Buffer.from(pdf);
  }

  private async withRenderTimeout(
    element: Parameters<typeof renderToBuffer>[0],
  ): Promise<Uint8Array> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.logger.warn("El render del documento superó el timeout");
        reject(new RequestTimeoutException("El render tardó demasiado"));
      }, PDF_RENDER_TIMEOUT_MS);
    });

    try {
      return await Promise.race([renderToBuffer(element), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
