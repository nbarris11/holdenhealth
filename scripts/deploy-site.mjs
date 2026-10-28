import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const linkedProject = JSON.parse(await readFile(path.join(root, ".vercel/project.json"), "utf8"));
if (linkedProject.projectName !== "holdenhealth") {
  throw new Error(`Website deploy stopped: expected holdenhealth but found ${linkedProject.projectName ?? "an unknown project"}.`);
}

const args = ["vercel", "deploy", ".", "--prod", "--yes", "--force"];
if (process.env.VERCEL_GLOBAL_CONFIG) args.push("--global-config", process.env.VERCEL_GLOBAL_CONFIG);
const result = spawnSync("npx", args, { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Website deployment failed with exit code ${result.status ?? "unknown"}.`);
