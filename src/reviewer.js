import fs from "node:fs";
import path from "node:path";
import { DEPENDENCY_FILES, SENSITIVE_PATHS, TOOL } from "./constants.js";
import { fileExists, readJson, readJsonLines, resolveFlightRun, resolveSandboxRun, runCommand, runGit } from "./utils.js";

export async function reviewGitDiff({ cwd = process.cwd(), prompt = "" } = {}) {
  const files = await changedFilesFromGit(cwd);
  return review({ cwd, prompt, files, events: [], source: "git-diff" });
}

export async function reviewGithubPr(prNumber, { cwd = process.cwd(), prompt = "" } = {}) {
  if (!prNumber) throw new Error("--github-pr requires a pull request number.");
  if (!/^\d+$/.test(String(prNumber))) throw new Error("--github-pr must be a pull request number.");
  let diff = "";
  try {
    diff = await runCommand("gh", ["pr", "diff", String(prNumber)], cwd);
  } catch (error) {
    throw new Error(`Could not read GitHub PR ${prNumber}. Install gh, authenticate it, or run from a repo with GitHub access. ${error.message}`);
  }
  return review({
    cwd,
    prompt: prompt || `Review GitHub PR ${prNumber}`,
    files: extractFilesFromDiff(diff),
    events: [],
    source: "github-pr",
    run: { runId: `pr_${prNumber}` }
  });
}

export async function reviewFlightRun(idOrPath = "latest", { cwd = process.cwd() } = {}) {
  let target = resolveFlightRun(idOrPath, cwd);
  if (idOrPath === "latest") {
    if (!(await fileExists(target))) throw new Error("No Agent Flight latest pointer found.");
    const runId = (await fs.promises.readFile(target, "utf8")).trim();
    target = path.join(cwd, ".agent-flight", "runs", `${runId}.json`);
  }
  const run = await readJson(target);
  const files = run.gitDiffSummary?.files || extractFilesFromDiff(run.gitDiff || "");
  return review({ cwd, prompt: run.prompt || "", files, events: run.events || [], source: "agent-flight", run });
}

export async function reviewSandboxRun(idOrPath = "latest", { cwd = process.cwd() } = {}) {
  let target = resolveSandboxRun(idOrPath, cwd);
  if (idOrPath === "latest") {
    if (!(await fileExists(target))) throw new Error("No Agent Sandbox latest pointer found.");
    const runId = (await fs.promises.readFile(target, "utf8")).trim();
    target = path.join(cwd, ".agent-sandbox", "runs", `${runId}.json`);
  }
  const run = await readJson(target);
  const files = [
    ...(run.changes?.created || []),
    ...(run.changes?.modified || []),
    ...(run.changes?.deleted || [])
  ];
  return review({
    cwd,
    prompt: run.command?.join(" ") || "",
    files,
    events: [{ type: "shell.exec", command: run.command?.join(" ") || "", exitCode: run.exitCode }],
    source: "agent-sandbox",
    run
  });
}

export async function reviewFirewallLogs({ cwd = process.cwd(), limit = 100 } = {}) {
  const logs = (await readJsonLines(path.join(cwd, ".mcp-firewall", "logs.jsonl"))).slice(-limit);
  const findings = [];
  const events = [];

  for (const log of logs) {
    const toolName = log.toolCall?.tool || log.tool || log.type || "unknown";
    const command = log.toolCall?.input?.command;
    if (command) events.push({ type: "shell.exec", command, exitCode: log.action === "block" ? 1 : 0 });

    if (log.action === "block") {
      findings.push({
        type: "firewall-block",
        severity: log.risk === "critical" || log.risk === "high" ? "high" : "medium",
        message: `MCP Firewall blocked ${toolName}.`,
        policyMatched: log.policyMatched
      });
    } else if (["warn", "allow", "approve_once", "approve_for_project"].includes(log.action) && ["high", "critical"].includes(log.risk)) {
      findings.push({
        type: "firewall-risk",
        severity: "high",
        message: `High-risk MCP tool call was ${log.action}: ${toolName}.`,
        policyMatched: log.policyMatched
      });
    }
  }

  return review({
    cwd,
    prompt: "Review MCP Firewall logs",
    files: [],
    events,
    source: "mcp-firewall",
    extraFindings: findings,
    requireTests: false
  });
}

export function review({ cwd = process.cwd(), prompt = "", files = [], events = [], source = "input", run = undefined, extraFindings = [], requireTests = true } = {}) {
  const findings = [];
  const normalizedFiles = [...new Set(files.filter(Boolean))];
  const sensitive = normalizedFiles.filter((file) => SENSITIVE_PATHS.some((pattern) => pattern.test(file)));
  const dependencies = normalizedFiles.filter((file) => DEPENDENCY_FILES.includes(path.basename(file)));
  const testsRan = events.some((event) => /test|jest|vitest|pytest|cargo test|go test/i.test(event.command || ""));
  const riskyShell = events.filter((event) => event.type === "shell.exec" && /rm -rf|curl .*sh|sudo|chmod 777|scp|ssh/i.test(event.command || ""));
  const likelyUiPrompt = /ui|button|alignment|css|style|component|layout|pricing/i.test(prompt);
  const nonUiSensitive = likelyUiPrompt && sensitive.length > 0;

  if (sensitive.length > 0) {
    findings.push({
      type: "sensitive-files",
      severity: "high",
      message: "Sensitive files changed.",
      files: sensitive
    });
  }
  if (nonUiSensitive) {
    findings.push({
      type: "scope",
      severity: "high",
      message: "Prompt appears UI-focused, but sensitive files changed.",
      files: sensitive
    });
  }
  if (dependencies.length > 0) {
    findings.push({
      type: "dependencies",
      severity: "medium",
      message: "Dependency or lock files changed.",
      files: dependencies
    });
  }
  if (requireTests && !testsRan) {
    findings.push({
      type: "tests",
      severity: "medium",
      message: "No test execution detected."
    });
  }
  if (riskyShell.length > 0) {
    findings.push({
      type: "shell",
      severity: "high",
      message: "Risky shell commands detected.",
      commands: riskyShell.map((event) => event.command)
    });
  }
  if (normalizedFiles.length > 12) {
    findings.push({
      type: "scope",
      severity: "medium",
      message: "Large number of files changed.",
      files: normalizedFiles
    });
  }

  findings.push(...extraFindings);

  const risk = highestSeverity(findings);
  return {
    schemaVersion: "1.0",
    tool: TOOL,
    source,
    cwd,
    prompt,
    runId: run?.runId,
    score: scoreForRisk(risk, findings.length),
    risk,
    summary: summaryForRisk(risk),
    changedFiles: normalizedFiles,
    testsDetected: testsRan,
    findings,
    recommendation: recommendationForRisk(risk)
  };
}

async function changedFilesFromGit(cwd) {
  const names = await runGit(["diff", "--name-only"], cwd);
  return names.split(/\r?\n/).filter(Boolean);
}

function extractFilesFromDiff(diff) {
  return [...String(diff).matchAll(/^diff --git a\/(.+?) b\//gm)].map((match) => match[1]);
}

function highestSeverity(findings) {
  if (findings.some((finding) => finding.severity === "high")) return "high";
  if (findings.some((finding) => finding.severity === "medium")) return "medium";
  if (findings.length > 0) return "low";
  return "low";
}

function scoreForRisk(risk, count) {
  if (risk === "high") return count >= 3 ? "D" : "C";
  if (risk === "medium") return "B";
  return "A";
}

function summaryForRisk(risk) {
  if (risk === "high") return "High-risk agent behavior detected.";
  if (risk === "medium") return "Review recommended before accepting changes.";
  return "No high-risk agent behavior detected.";
}

function recommendationForRisk(risk) {
  if (risk === "high") return "Do not merge until sensitive or out-of-scope changes are manually reviewed.";
  if (risk === "medium") return "Review findings and run tests before accepting the diff.";
  return "Proceed with normal review.";
}
