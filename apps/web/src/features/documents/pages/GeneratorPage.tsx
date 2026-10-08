import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import {
  CorporateTemplate,
  MinimalTemplate,
  type DocumentTemplateProps,
} from "@taskmaster/templates";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AdvancedOptions } from "../components/AdvancedOptions";
import type { DocumentOptions } from "../components/AdvancedOptions";
import { MarkdownEditor } from "../components/MarkdownEditor";

const COMPONENTS: Record<
  string,
  (props: DocumentTemplateProps) => React.ReactElement
> = {
  minimal: MinimalTemplate,
  corporate: CorporateTemplate,
};

const TEMPLATE_CHOICES = [
  { value: "minimal", label: "Minimal" },
  { value: "corporate", label: "Corporate" },
];

const DEFAULT_OPTIONS: DocumentOptions = {
  fontSize: "md",
  margin: "normal",
  accentColor: "#1e3a5f",
};

export function GeneratorPage() {
  const [content, setContent] = useState("");
  const [template, setTemplate] = useState("minimal");
  const [options, setOptions] = useState<DocumentOptions>(DEFAULT_OPTIONS);

  const DocumentComponent = COMPONENTS[template] ?? MinimalTemplate;

  const documentProps = useMemo<DocumentTemplateProps>(
    () => ({
      content,
      fontSize: options.fontSize,
      margin: options.margin,
      accentColor: options.accentColor,
    }),
    [content, options],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Generador de documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Escribí tu texto con jerarquía y descargá el PDF.
          </p>
        </div>

        <PDFDownloadLink
          document={<DocumentComponent {...documentProps} />}
          fileName="documento.pdf"
          className={cn(buttonVariants(), "h-10")}
        >
          {({ loading }) =>
            loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Descargar PDF
              </>
            )
          }
        </PDFDownloadLink>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="doc-template" className="text-sm font-medium">
            Plantilla
          </Label>
          <Select
            id="doc-template"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            className="h-8 w-44"
          >
            {TEMPLATE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <AdvancedOptions
        value={options}
        onChange={setOptions}
        showAccentColor={true}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Contenido</span>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            className="min-h-[420px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Vista previa</span>
          <div className="min-h-[420px] overflow-hidden rounded-md border border-border/70 bg-background">
            <PDFViewer width="100%" height="100%" style={{ border: "none" }}>
              <DocumentComponent {...documentProps} />
            </PDFViewer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneratorPage;
