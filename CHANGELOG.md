# Changelog

All notable changes to this project are documented in this file.
This project follows [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [1.0.0] - 2026-04-26

- Initial public release of Agent Review.
- Reviews agent behavior from git diffs, Agent Flight Recorder runs, Agent Sandbox runs, MCP Firewall logs, or GitHub PRs (`gh`).
- Commands: `agent-review [latest|run_id|--from-* |--github-pr ...]`, `update`.
- Detects sensitive-file changes, dependency churn, missing tests, risky shell commands, scope drift, and large diffs from narrow prompts.
- JSON output and `--ci --fail-on <severity>` for pipeline gates.
- Status words use plain language (`ok`, `failed (exit N)`, `skipped (reason)`); raw exit codes are preserved alongside for debugging.
