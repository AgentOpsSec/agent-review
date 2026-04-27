# Agent Review

![NPM Downloads](https://img.shields.io/npm/dw/%40agentopssec%2Fagent-review)

**Review the agent's behavior, not just the code diff.**

Agent Review evaluates AI agent runs for unsafe, unnecessary, or suspicious
behavior. It helps developers understand whether an agent stayed in scope,
changed sensitive files, skipped tests, added dependencies, or took risky
actions on the way to a final diff.

Think of it as:

```txt
Code review for agent behavior
```

## Why This Exists

Traditional code review looks at the final diff. Agent-generated work also
needs review of the path the agent took.

Agent Review answers questions like:

- Did the agent modify files outside the requested scope?
- Did it touch auth, security, CI, deployment, or secrets?
- Did it add dependencies unnecessarily?
- Did it delete code instead of fixing it?
- Did it skip tests?
- Did it change public APIs?
- Did it create migrations?
- Did it hide or ignore errors?
- Did it run risky shell commands?
- Where should a human reviewer focus first?

Agent Review turns agent behavior into concrete findings.

## Install

```bash
npm install -g @agentopssec/agent-review
```

Or run it without installing:

```bash
npx -y @agentopssec/agent-review --from-git-diff
```

## Update

```bash
agent-review update          # check the registry, prompt before installing
agent-review update --yes    # update without prompting
```

## Primary Workflow

Agent Review starts by reviewing a local diff or recorded agent run:

```bash
agent-review --from-git-diff
```

The workflow should do three things well:

1. Detect risky behavior and sensitive changes.
2. Compare the requested task to the files changed.
3. Produce a clear risk score and review summary.

## CLI

```bash
agent-review latest
agent-review run_001
agent-review --from-git-diff
agent-review --from-agent-flight run_001
agent-review --from-agent-sandbox run_001
agent-review --from-mcp-firewall
agent-review --github-pr 123
agent-review --ci
agent-review --ci --fail-on medium
agent-review --json
agent-review update [--yes]
```

## Standalone and Stack Use

Agent Review runs on its own against the current git diff:

```bash
agent-review --from-git-diff
```

When used with the full AgentOpsSec stack, it can optionally review logs from
Agent Flight Recorder, Agent Sandbox, and MCP Firewall. These are file-based
inputs, not package dependencies:

```bash
agent-review --from-agent-flight latest
agent-review --from-agent-sandbox latest
agent-review --from-mcp-firewall
```

## What Agent Review Checks

Agent Review analyzes agent logs, git diffs, tool calls, and command history for:

- Files changed outside likely scope
- Sensitive file changes
- Dependency changes
- Missing tests
- Risky shell commands
- Secret file access
- CI/CD config changes
- Auth and permission logic changes
- Database migrations
- Public API changes
- Production config changes
- Large diffs from narrow prompts
- Suspicious file deletion
- Error suppression

## Example Output

```txt
Agent Review by github.com/AgentOpsSec

Prompt:
Fix the pricing card button alignment.

Result:
High-risk agent behavior detected.

Findings:
- Modified files outside likely UI scope
- Changed auth/session.ts
- Changed middleware.ts
- Added new dependency
- No tests detected

Recommendation:
Do not merge until security-sensitive files are manually reviewed.

Score: D
```

## Review Result Shape

```json
{
  "tool": {
    "name": "Agent Review",
    "by": "github.com/AgentOpsSec",
    "repository": "github.com/AgentOpsSec/agent-review"
  },
  "score": "D",
  "risk": "high",
  "summary": "High-risk agent behavior detected.",
  "findings": [
    {
      "type": "scope",
      "severity": "high",
      "message": "Task appears UI-only, but auth files changed.",
      "files": ["auth/session.ts", "middleware.ts"]
    },
    {
      "type": "tests",
      "severity": "medium",
      "message": "No test execution detected."
    }
  ],
  "recommendation": "Review security-sensitive files before accepting the diff."
}
```

## Input Sources

Agent Review can consume:

- Local git diffs
- Agent Flight Recorder logs
- MCP Firewall logs
- Shell command history
- Tool-call logs
- Pull request metadata
- CI output

It outputs:

- Risk score
- Review summary
- Scope assessment
- Sensitive file warnings
- Dependency warnings
- Test status
- Recommended reviewer focus
- JSON for automation

GitHub pull request review uses the GitHub CLI:

```bash
gh auth login
agent-review --github-pr 123
```

## Design Principles

- Local-first
- Open-source
- No telemetry by default
- Rule-based and explainable
- CI-friendly
- Focused reviewer guidance
- Conservative around sensitive changes
- Useful without hosted infrastructure

## Initial Release Scope

The initial release includes local diff review, agent log review, sensitive file
detection, dependency warnings, test detection, and CI-friendly output.

### 1.0: Local Diff Review

- Read the current git diff
- Categorize changed files
- Detect sensitive paths and config files
- Detect dependency and lockfile changes
- Detect broad diffs from narrow task descriptions
- Generate a terminal review summary

### 1.0: Agent Run Review

- Read Agent Flight Recorder logs
- Compare prompt intent to changed files
- Detect whether tests ran
- Detect risky shell commands
- Detect secret file access when logs include it
- Produce reviewer focus areas

### 1.0: Automation and Scoring

- Generate a structured risk score
- Support JSON output
- Support CI mode
- Emit pass, warn, or fail decisions
- Summarize findings by severity
- Support pull request review inputs


## Output

Reports use plain-language status words rather than raw exit codes:

- `ok` — the step ran successfully (green).
- `failed (exit N)` — the step exited non-zero (red); the original code is preserved.
- `skipped (reason)` — the step was not applicable (dim).

Severity colors follow the AgentOpsSec palette (safe = green, warning = amber, risk = red). The palette honors `NO_COLOR` and `FORCE_COLOR`, and JSON / CSV output stays plain.


- Repo: https://github.com/AgentOpsSec/agent-review
- npm: https://www.npmjs.com/package/@agentopssec/agent-review
- AgentOpsSec stack: https://github.com/AgentOpsSec/stack
- Website: https://AgentOpsSec.com

## Author

Created and developed by **Aunt Gladys Nephew**.

- Website: https://auntgladysnephew.com
- GitHub: https://github.com/auntgladysnephew
- X: https://x.com/AGNonX
