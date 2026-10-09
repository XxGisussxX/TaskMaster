import { Body, Controller, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
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

  // El render de PDF es costoso en CPU: 10/min por IP en vez del default
  // global de 120/min.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
