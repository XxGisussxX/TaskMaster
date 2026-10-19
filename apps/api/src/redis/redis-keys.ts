/**
 * Nombres de las keys de Redis.
 *
 * Funciones puras y sin dependencias para que el formato sea verificable con
 * tests unitarios: una key mal formada no rompe nada visible hasta que hay
 * varias réplicas, que es exactamente cuando nadie la está mirando.
 *
 * Las keys del lockout y del throttler llevan el email hasheado (sha256) y no el
 * email: la PII no debe quedar en Redis ni en los logs de `MONITOR`/`SCAN`.
 * El `generateKey` del throttler ya hashea el tracker, así que `key` nunca
 * contiene el email en claro.
 *
 * Las llaves `{}` son *hash tags* de Redis Cluster: fuerzan a que un grupo de
 * keys caiga en el mismo slot, que es un requisito para usarlas juntas dentro
 * de un script Lua. Hoy el docker-compose usa una instancia sola y las llaves
 * son inertes, pero hacen el código portable a Cluster sin tocarlo.
 */

/** Key del ZSET de hits de un limitador. Comparte slot con {@link throttlerBlockKey}. */
export function throttlerHitsKey(
  prefix: string,
  key: string,
  throttlerName: string,
): string {
  return `${prefix}:rl:{${key}:${throttlerName}}:hits`;
}

/** Key del marcador de bloqueo de un limitador. Comparte slot con {@link throttlerHitsKey}. */
export function throttlerBlockKey(
  prefix: string,
  key: string,
  throttlerName: string,
): string {
  return `${prefix}:rl:{${key}:${throttlerName}}:block`;
}

/** Contador de fallos de login. Comparte slot con {@link lockoutBlockKey}. */
export function lockoutCountKey(prefix: string, emailHash: string): string {
  return `${prefix}:lockout:{${emailHash}}:count`;
}

/** Marcador de bloqueo de la cuenta. Comparte slot con {@link lockoutCountKey}. */
export function lockoutBlockKey(prefix: string, emailHash: string): string {
  return `${prefix}:lockout:{${emailHash}}:block`;
}

/**
 * Cuota diaria de IA por usuario y workspace.
 *
 * Sin hash tag: el script solo toca esta key, así que no hay nada que agrupar.
 * El `userId` es un cuid, no PII, y mantenerlo legible facilita operar con
 * `GET` cuando hay que auditar por qué un usuario quedó sin cuota.
 *
 * El `workspaceId` acota la cuota al workspace donde se consume el asistente:
 * un mismo usuario puede ser miembro de varios workspaces y cada uno lleva su
 * propio contador, coherente con `/workspaces/:id/ai/usage`.
 *
 * `day` va en la key (y no como TTL) para que el día local sea explícito y no
 * dependa de la zona horaria del servidor de Redis.
 */
export function aiQuotaKey(
  prefix: string,
  userId: string,
  workspaceId: string,
  day: string,
): string {
  return `${prefix}:ai:quota:${userId}:${workspaceId}:${day}`;
}
