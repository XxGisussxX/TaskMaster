export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">La página que buscas no existe</p>
      <a
        href="/"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Volver al inicio
      </a>
    </div>
  );
}
