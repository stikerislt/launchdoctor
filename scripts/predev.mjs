import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const clientIndex = path.join(process.cwd(), "node_modules", "@prisma", "client", "index.js");

try {
  execSync("pnpm exec prisma generate", { stdio: "inherit" });
} catch {
  if (existsSync(clientIndex)) {
    console.warn(
      "prisma generate skipped: query engine is locked (stop `pnpm worker` before restarting dev). Using existing client.",
    );
    process.exit(0);
  }

  console.error("prisma generate failed and no Prisma client was found.");
  process.exit(1);
}
