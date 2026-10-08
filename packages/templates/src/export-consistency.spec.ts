import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as srcIndex from "../src/index";
import * as distIndex from "../dist/index.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  exports: Record<
    string,
    { types: string; import: string; require: string; default: string }
  >;
};

describe("export consistency (src vs dist)", () => {
  it("keeps dist in sync with src so CJS consumers get the same API", () => {
    const distPath = fileURLToPath(
      new URL("../dist/index.js", import.meta.url),
    );
    if (!existsSync(distPath)) {
      return; // dist not built yet; check:dist is meant to run after `build`
    }

    const srcKeys = Object.keys(srcIndex).sort();
    const distKeys = Object.keys(distIndex)
      .filter((key) => key !== "default")
      .sort();

    expect(distKeys).toEqual(srcKeys);

    const requireTarget = packageJson.exports["."]!.require;
    expect(requireTarget).toContain("dist/index.js");
  });
});
