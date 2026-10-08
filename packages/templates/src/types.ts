export type FontSizeOption = "sm" | "md" | "lg";

export type MarginOption = "narrow" | "normal" | "wide";

export interface DocumentTemplateProps {
  content: string;
  fontSize?: FontSizeOption;
  margin?: MarginOption;
  accentColor?: string;
  title?: string;
  generatedAt?: Date;
}
