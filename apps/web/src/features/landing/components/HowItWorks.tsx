import { ArrowRight, FolderPlus, ListTodo, UsersRound } from "lucide-react";

const steps = [
  {
    icon: FolderPlus,
    title: "1. Crea tu espacio de trabajo",
    description:
      "Configura tu espacio, invita a tu equipo y define cómo quieres organizarlo.",
  },
  {
    icon: ListTodo,
    title: "2. Organiza tus tareas",
    description:
      "Crea tareas, asígnalas, priorízalas y arrástralas por tu tablero Kanban.",
  },
  {
    icon: UsersRound,
    title: "3. Colabora y completa objetivos",
    description:
      "Comenta, comparte avances con tu equipo y lleva todo a término con claridad.",
  },
];

export function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Cómo funciona
        </h2>
        <p className="mt-3 text-balance text-muted-foreground">
          Empieza en minutos y mantén todo bajo control desde el primer día.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative flex flex-col items-center rounded-lg border border-border/70 bg-card p-6 text-center"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {step.description}
            </p>
            {index < steps.length - 1 && (
              <ArrowRight className="absolute -right-6 top-1/2 hidden -translate-y-1/2 text-muted-foreground md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
