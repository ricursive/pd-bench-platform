// Copy the repo's synthetic fixture into web/public so the static site can
// fetch + parse the DEFs client-side. Source of truth is /fixtures (generated
// by fixtures/gen_fixture.py). Runs automatically via predev/prebuild.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../fixtures/ariane133");
const dst = resolve(here, "../public/fixtures/ariane133");

if (!existsSync(src)) {
  console.warn(`[sync-fixtures] no fixture at ${src}; run fixtures/gen_fixture.py`);
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });

// also expose the real task instruction.md so the task page renders it faithfully
const instr = resolve(
  here,
  "../../tasks/ricursive/ariane133-asap7-mixed-placement/instruction.md",
);
if (existsSync(instr)) cpSync(instr, resolve(dst, "instruction.md"));
console.log(`[sync-fixtures] ${src} -> ${dst}`);
