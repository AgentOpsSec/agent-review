import { brandedTitle } from "./constants.js";
import { dim, green, red, risk as paintRisk } from "./tui.js";

export function renderReview(result) {
  const lines = [brandedTitle(), ""];
  if (result.prompt) {
    lines.push("Prompt:");
    lines.push(result.prompt);
    lines.push("");
  }
  lines.push("Result:");
  lines.push(paintRisk(result.risk, result.summary));
  lines.push("");
  lines.push(`Risk: ${paintRisk(result.risk, result.risk)}`);
  lines.push(`Score: ${paintRisk(scoreSeverity(result.score), result.score)}`);
  lines.push(`Tests detected: ${result.testsDetected ? green("yes") : red("no")}`);
  lines.push("");
  lines.push("Findings:");
  if (result.findings.length === 0) {
    lines.push(green("- none"));
  } else {
    for (const finding of result.findings) {
      lines.push(`- [${paintRisk(finding.severity, finding.severity)}] ${finding.message}`);
      if (finding.files?.length) lines.push(`  Files: ${finding.files.join(", ")}`);
      if (finding.commands?.length) lines.push(`  Commands: ${finding.commands.join(", ")}`);
    }
  }
  lines.push("");
  lines.push("Recommendation:");
  lines.push(paintRisk(result.risk, result.recommendation));
  return `${lines.join("\n")}\n`;
}

function scoreSeverity(score) {
  if (score === "F" || score === "D") return "high";
  if (score === "C" || score === "C+" || score === "B-" || score === "B") return "medium";
  return "low";
}
