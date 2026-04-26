export const BRAND = "github.com/AgentOpsSec";
export const VERSION = "1.0.0";
export const TOOL = {
  name: "Agent Review",
  by: BRAND,
  repository: "github.com/AgentOpsSec/agent-review"
};

export function brandedTitle(label = "") {
  return ["Agent Review", label, `by ${BRAND}`].filter(Boolean).join(" ");
}

export const SENSITIVE_PATHS = [
  /^\.env/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)\.aws(\/|$)/,
  /(^|\/)\.github\/workflows\//,
  /auth|session|middleware|permission|security/i,
  /terraform|k8s|kubernetes|deploy|production/i
];

export const DEPENDENCY_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod"
];
