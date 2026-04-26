import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }
    if (["--from-git-diff", "--from-mcp-firewall", "--json", "--ci", "--help", "-h"].includes(arg)) {
      const key = arg.replace(/^--?/, "");
      flags[key === "h" ? "help" : key] = true;
      continue;
    }
    const [key, inline] = arg.replace(/^--/, "").split("=", 2);
    const value = inline ?? args[i + 1];
    if (inline === undefined) {
      if (value === undefined || String(value).startsWith("-")) throw new Error(`--${key} requires a value.`);
      i += 1;
    }
    flags[key] = value;
  }
  return { flags, positional };
}

export async function runGit(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trimEnd();
  } catch {
    return "";
  }
}

export async function runCommand(command, args, cwd) {
  const { stdout } = await execFileAsync(command, args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trimEnd();
}

export async function readJson(filePath) {
  return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
}

export async function fileExists(filePath) {
  try { return (await fs.promises.stat(filePath)).isFile(); } catch { return false; }
}

export function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function resolveFlightRun(idOrPath, cwd) {
  if (!idOrPath || idOrPath === "latest") return path.join(cwd, ".agent-flight", "latest");
  if (idOrPath.endsWith(".json") || idOrPath.includes(path.sep)) return path.resolve(cwd, idOrPath);
  return path.join(cwd, ".agent-flight", "runs", `${idOrPath}.json`);
}

export function resolveSandboxRun(idOrPath, cwd) {
  if (!idOrPath || idOrPath === "latest") return path.join(cwd, ".agent-sandbox", "latest");
  if (idOrPath.endsWith(".json") || idOrPath.includes(path.sep)) return path.resolve(cwd, idOrPath);
  return path.join(cwd, ".agent-sandbox", "runs", `${idOrPath}.json`);
}

export async function readJsonLines(filePath) {
  if (!(await fileExists(filePath))) return [];
  const raw = await fs.promises.readFile(filePath, "utf8");
  const records = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // Ignore corrupt local log lines so review can still inspect remaining events.
    }
  }
  return records;
}
