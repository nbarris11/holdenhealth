import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const portalRoot = path.join(repositoryRoot, "web-app");
const portalLink = path.join(portalRoot, ".vercel");
const dryRun = process.argv.includes("--dry-run");

const ignoredDirectories = new Set(["node_modules", ".next", ".vercel"]);

function shouldCopy(source) {
  const relativePath = path.relative(portalRoot, source);
  if (!relativePath) return true;

  const parts = relativePath.split(path.sep);
  if (parts.some((part) => ignoredDirectories.has(part))) return false;

  const fileName = path.basename(source);
  if (fileName.startsWith(".env") && fileName !== ".env.example") return false;

  return true;
}

const linkedProject = JSON.parse(
  await readFile(path.join(portalLink, "project.json"), "utf8"),
);

if (linkedProject.projectName !== "holdenhealth-portal") {
  throw new Error(
    `Portal deploy stopped: expected holdenhealth-portal but found ${linkedProject.projectName ?? "an unknown project"}.`,
  );
}

const stagingRoot = await mkdtemp(path.join(tmpdir(), "holdenhealth-portal-deploy-"));
const stagedPortal = path.join(stagingRoot, "web-app");

try {
  await cp(portalRoot, stagedPortal, { recursive: true, filter: shouldCopy });
  await cp(portalLink, path.join(stagingRoot, ".vercel"), { recursive: true });

  if (dryRun) {
    console.log("Portal deploy check passed. No deployment was created.");
    process.exitCode = 0;
  } else {
    console.log("Deploying holdenhealth-portal from web-app...");
    const deployment = spawnSync(
      "npx",
      ["vercel", "deploy", ".", "--prod", "--yes", "--force", ...(process.env.VERCEL_GLOBAL_CONFIG ? ["--global-config", process.env.VERCEL_GLOBAL_CONFIG] : [])],
      { cwd: stagingRoot, stdio: "inherit" },
    );

    if (deployment.error) throw deployment.error;
    if (deployment.status !== 0) {
      throw new Error(`Portal deployment failed with exit code ${deployment.status ?? "unknown"}.`);
    }
  }
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
