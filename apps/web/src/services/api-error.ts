/**
 * Vive en su propio módulo, y no en `http.ts`, para que el cliente de sesión
 * pueda importar `ApiError` sin formar un ciclo con el wrapper de `fetch`.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
