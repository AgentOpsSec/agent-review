import path from "node:path";
import { brandedTitle, VERSION } from "./constants.js";
import { renderReview } from "./report.js";
import { reviewFirewallLogs, reviewFlightRun, reviewGitDiff, reviewGithubPr, reviewSandboxRun } from "./reviewer.js";
import { amber, green, paint, setColor, shouldColor } from "./tui.js";
import { updateOne } from "./updater.js";
import { parseArgs, stringify } from "./utils.js";

const PACKAGE_NAME = "@agentopssec/agent-review";

async function runUpdate(args, io) {
  const flagSet = new Set(args);
  await updateOne({
    packageName: PACKAGE_NAME,
    currentVersion: VERSION,
    title: brandedTitle("Update"),
    color: { amber, green },
    io,
    yes: flagSet.has("--yes") || flagSet.has("-y")
  });
}

export async function main(argv = process.argv.slice(2), io = defaultIo()) {
  if (argv.length === 0 || ["help", "--help", "-h"].includes(argv[0])) return io.stdout(help());
  if (["version", "--version", "-v"].includes(argv[0])) return io.stdout(`agent-review ${VERSION}\n`);
  if (["update", "--update"].includes(argv[0])) return runUpdate(argv.slice(1), io);
  const { flags, positional } = parseArgs(argv);
  if (flags.help) return io.stdout(help());
  const cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  let result;
  if (flags["github-pr"]) {
    result = await reviewGithubPr(flags["github-pr"], { cwd, prompt: flags.prompt || "" });
  } else if (flags["from-agent-flight"]) {
    result = await reviewFlightRun(flags["from-agent-flight"], { cwd });
  } else if (flags["from-agent-sandbox"]) {
    result = await reviewSandboxRun(flags["from-agent-sandbox"], { cwd });
  } else if (flags["from-mcp-firewall"]) {
    result = await reviewFirewallLogs({ cwd, limit: Number(flags.limit || 100) });
  } else if (flags["from-git-diff"]) {
    result = await reviewGitDiff({ cwd, prompt: flags.prompt || "" });
  } else if (positional[0] === "latest" || /^run_\d+/.test(positional[0] || "")) {
    result = await reviewFlightRun(positional[0], { cwd });
  } else {
    result = await reviewGitDiff({ cwd, prompt: flags.prompt || positional.join(" ") });
  }
  if (flags.json) io.stdout(stringify(result));
  else io.stdout(renderReview(result));
  if (flags.ci && isRiskAtLeast(result.risk, flags["fail-on"] || "high")) io.setExitCode(1);
}

function isRiskAtLeast(actual, threshold) {
  const weights = { low: 1, medium: 2, high: 3 };
  return (weights[actual] || 0) >= (weights[threshold] || 3);
}

function help() {
  return [
    brandedTitle(),
    "",
    "Usage:",
    "  agent-review --from-git-diff",
    "  agent-review latest",
    "  agent-review run_001",
    "  agent-review --from-agent-flight run_001",
    "  agent-review --from-agent-sandbox run_001",
    "  agent-review --from-mcp-firewall",
    "  agent-review --github-pr 123",
    "  agent-review --ci",
    "  agent-review --fail-on medium",
    "  agent-review --json",
    "  agent-review update [--yes]"
  ].join("\n") + "\n";
}

function defaultIo() {
  setColor(shouldColor(process.stdout));
  return {
    stdout: (text) => process.stdout.write(paint(text)),
    stderr: (text) => process.stderr.write(paint(text)),
    setExitCode: (code) => { process.exitCode = code; }
  };
}
