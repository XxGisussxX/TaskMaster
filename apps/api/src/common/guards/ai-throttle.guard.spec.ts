import { describe, expect, it } from "vitest";
import { AiThrottleGuard } from "./ai-throttle.guard";

/**
 * Se instancia directo con dependencias vacías porque solo se ejercita
 * `getTracker`, que no las usa: el contador real (storage) no entra en juego.
 */
function build(): AiThrottleGuard & {
  getTracker(req: Record<string, any>): Promise<string>;
} {
  return new AiThrottleGuard([] as never, {} as never, {} as never) as never;
}

describe("AiThrottleGuard.getTracker", () => {
  it("usa usuario y workspace como clave cuando hay sesión", async () => {
    const key = await build().getTracker({
      user: { sub: "u1" },
      params: { workspaceId: "ws1" },
    });

    expect(key).toBe("u1:ws1");
  });

  it("separa la cuota de un mismo usuario por workspace", async () => {
    const guard = build();

    const a = await guard.getTracker({
      user: { sub: "u1" },
      params: { workspaceId: "ws1" },
    });
    const b = await guard.getTracker({
      user: { sub: "u1" },
      params: { workspaceId: "ws2" },
    });

    expect(a).not.toBe(b);
  });

  it("cae al tracker por IP del guard padre cuando no hay usuario", async () => {
    const key = await build().getTracker({ ip: "1.2.3.4" });

    expect(key).toBe("1.2.3.4");
  });
});
