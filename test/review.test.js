import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { main } from "../src/cli.js";
import { review } from "../src/reviewer.js";

function io() {
  let output = "";
  let exitCode = 0;
  return {
    api: {
      stdout: (text) => { output += text; },
      setExitCode: (code) => { exitCode = code; }
    },
    get output() { return output; },
    get exitCode() { return exitCode; }
  };
}

test("review flags sensitive files and missing tests", () => {
  const result = review({
    prompt: "Fix the pricing button alignment",
    files: ["components/Pricing.tsx", "auth/session.ts", "package.json"],
    events: []
  });
  assert.equal(result.tool.by, "github.com/AgentOpsSec");
  assert.equal(result.risk, "high");
  assert.ok(result.findings.some((finding) => finding.type === "scope"));
  assert.ok(result.findings.some((finding) => finding.type === "dependencies"));
});

test("CLI reviews Agent Flight run logs", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-review-"));
  const runsDir = path.join(cwd, ".agent-flight", "runs");
  await fs.promises.mkdir(runsDir, { recursive: true });
  await fs.promises.writeFile(path.join(cwd, ".agent-flight", "latest"), "run_001", "utf8");
  await fs.promises.writeFile(path.join(runsDir, "run_001.json"), JSON.stringify({
    runId: "run_001",
    prompt: "Fix button alignment",
    gitDiffSummary: { files: ["middleware.ts"] },
    events: [{ type: "shell.exec", command: "npm test" }]
  }), "utf8");
  const session = io();
  await main(["latest", "--cwd", cwd, "--ci"], session.api);
  assert.match(session.output, /Agent Review by github\.com\/AgentOpsSec/);
  assert.equal(session.exitCode, 1);
});

test("CLI reviews Agent Sandbox run logs without requiring Agent Flight", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-review-sandbox-"));
  const runsDir = path.join(cwd, ".agent-sandbox", "runs");
  await fs.promises.mkdir(runsDir, { recursive: true });
  await fs.promises.writeFile(path.join(cwd, ".agent-sandbox", "latest"), "run_001", "utf8");
  await fs.promises.writeFile(path.join(runsDir, "run_001.json"), JSON.stringify({
    runId: "run_001",
    command: ["codex", "fix button alignment"],
    changes: {
      created: [],
      modified: ["auth/session.ts"],
      deleted: []
    },
    exitCode: 0
  }), "utf8");
  const session = io();
  await main(["--from-agent-sandbox", "latest", "--cwd", cwd, "--ci"], session.api);
  assert.match(session.output, /Agent Review by github\.com\/AgentOpsSec/);
  assert.match(session.output, /Sensitive files changed/);
  assert.equal(session.exitCode, 1);
});

test("CLI reviews MCP Firewall logs without requiring other tools", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-review-firewall-"));
  const logsDir = path.join(cwd, ".mcp-firewall");
  await fs.promises.mkdir(logsDir, { recursive: true });
  await fs.promises.writeFile(path.join(logsDir, "logs.jsonl"), `${JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "tool-call",
    action: "block",
    risk: "high",
    policyMatched: "block-env",
    toolCall: {
      tool: "filesystem.read",
      input: { path: ".env" }
    }
  })}\n`, "utf8");
  const session = io();
  await main(["--from-mcp-firewall", "--cwd", cwd, "--ci"], session.api);
  assert.match(session.output, /MCP Firewall blocked filesystem\.read/);
  assert.equal(session.exitCode, 1);
});

test("CLI supports GitHub PR diffs through gh", async () => {
  const cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "agent-review-pr-"));
  const bin = path.join(cwd, "bin");
  await fs.promises.mkdir(bin);
  const gh = path.join(bin, "gh");
  await fs.promises.writeFile(gh, `#!/bin/sh
printf '%s\\n' 'diff --git a/auth/session.ts b/auth/session.ts'
`, "utf8");
  await fs.promises.chmod(gh, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
  try {
    const session = io();
    await main(["--github-pr", "123", "--cwd", cwd, "--ci", "--fail-on", "medium"], session.api);
    assert.match(session.output, /Agent Review by github\.com\/AgentOpsSec/);
    assert.match(session.output, /Sensitive files changed/);
    assert.equal(session.exitCode, 1);
  } finally {
    process.env.PATH = oldPath;
  }
});
