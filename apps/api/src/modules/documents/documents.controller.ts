import { Body, Controller, Post, Res } from "@nestjs/common";
import { Response } from "express";
import {
  generateDocumentSchema,
  type GenerateDocumentInput,
} from "@taskmaster/contracts";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("generate")
  async generate(
    @Body(new ZodPipe(generateDocumentSchema)) dto: GenerateDocumentInput,
    @Res() res: Response,
  ): Promise<void> {
    const pdfBuffer = await this.documentsService.generatePdf(dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length.toString());
    res.end(pdfBuffer);
  }
}
