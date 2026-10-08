import type { ReactElement } from "react";
import { TEMPLATES, type PdfTemplate, type TemplateId } from "../render/config";
import type { DocumentTemplateProps } from "../types";
import { CartaTemplate } from "./CartaTemplate";
import { CorporateTemplate } from "./CorporateTemplate";
import { EditorialTemplate } from "./EditorialTemplate";
import { InformeTemplate } from "./InformeTemplate";
import { MinimalTemplate } from "./MinimalTemplate";

type TemplateComponent = (props: DocumentTemplateProps) => ReactElement;

/** Mapa id → componente de plantilla. */
export const TEMPLATE_COMPONENTS: Record<TemplateId, TemplateComponent> = {
  minimal: MinimalTemplate,
  corporate: CorporateTemplate,
  editorial: EditorialTemplate,
  carta: CartaTemplate,
  informe: InformeTemplate,
};

export interface DocumentTemplateEntry {
  id: TemplateId;
  label: string;
  /** La UI muestra el selector de acento solo cuando la plantilla lo usa. */
  usesAccent: boolean;
  template: PdfTemplate;
  component: TemplateComponent;
}

/**
 * Registro único de plantillas para la UI (Fase 4): evita listas duplicadas
 * entre componentes y configuración.
 */
export const DOCUMENT_TEMPLATES: DocumentTemplateEntry[] = TEMPLATES.map(
  (template) => ({
    id: template.id,
    label: template.label,
    usesAccent: template.theme.usesAccent,
    template,
    component: TEMPLATE_COMPONENTS[template.id],
  }),
);
