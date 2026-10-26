import {
  BrainCircuit,
  CalendarClock,
  KanbanSquare,
  NotebookPen,
  StickyNote,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: KanbanSquare,
    title: "Tablero Kanban",
    description:
      "Visualiza el flujo de trabajo con columnas, arrastre y seguimiento claro del estado de cada tarea.",
  },
  {
    icon: CalendarClock,
    title: "Tareas y recordatorios",
    description:
      "Asigna prioridades, fechas de vencimiento y mantén el control con recordatorios oportunos.",
  },
  {
    icon: StickyNote,
    title: "Notas",
    description:
      "Guarda ideas, listas de verificación y notas rápidas con soporte para contenido enriquecido.",
  },
  {
    icon: Users,
    title: "Equipos y espacios",
    description:
      "Organiza por espacios de trabajo, invita colaboradores y gestiona permisos por equipo.",
  },
  {
    icon: NotebookPen,
    title: "Comentarios y seguimiento",
    description:
      "Colabora en cada tarea con comentarios, menciones y seguimiento centralizado.",
  },
  {
    icon: BrainCircuit,
    title: "Asistente IA",
    description:
      "Aprovecha el asistente de IA para agilizar la creación y organización de tus tareas.",
  },
];

export function Features() {
  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Todo lo que necesitas para mantenerte organizado
        </h2>
        <p className="mt-3 text-balance text-muted-foreground">
          Funcionalidades pensadas para ayudarte a pasar de idea a acción sin
          complejidad.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-border/70">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
