const marketplaceDescription =
  "Five architectural-decision skills: decide-architecture (compose a software architecture stack), design-patterns (choose the right GoF / Python-idiomatic pattern), agentic-patterns (design an LLM-agent control flow), test-patterns (compose a risk-led testing portfolio across quality practices, unit / integration / contract / end-to-end tests, and data / ML / LLM evaluation), and threat-model (architecture-level security — trust boundaries, authorization placement, secrets, data protection, supply chain, and agent permissions — every deterministic claim bound to a checker the repository already runs, and no maturity score in the output). Each branches on status — greenfield → selection interview → recommended design; refactoring → code review against the catalog → targeted improvements.";

const keywords = [
  "architecture",
  "design-patterns",
  "agentic",
  "llm-agents",
  "testing",
  "test-strategy",
  "unit-testing",
  "integration-testing",
  "end-to-end-testing",
  "qa",
  "llm-evals",
  "decision-support",
  "code-review",
  "security",
  "threat-model",
  "authorization",
  "secrets",
  "supply-chain",
  "refactoring",
  "greenfield",
  "ddd",
  "microservices",
  "gof",
  "python",
];

// Registered per the Claude Code hooks reference. Exec form (`command` plus
// `args`) is what the reference recommends for a path placeholder: each element
// is passed as one argument with no shell and no quoting. Verified 2026-09-09:
// there is no MultiEdit tool, hook input arrives on stdin rather than in
// $CLAUDE_TOOL_INPUT_PATH, and exit 2 on Stop would block the turn.
function hooks() {
  const handler = (name, extra = {}) => ({
    type: "command",
    command: "node",
    args: [`\${CLAUDE_PLUGIN_ROOT}/runtime/drift/${name}`],
    timeout: 10,
    ...extra,
  });

  return {
    description:
      "arch-crew drift-observation loop: inject the active architectural rules at session start, queue edited paths, and notice when the queue is non-empty. Advisory only — no hook here can block a tool call or a turn.",
    hooks: {
      // No matcher: an explicit source list would silently stop injecting if the
      // host ever adds a sixth SessionStart source.
      SessionStart: [{ hooks: [handler("inject-rules.mjs", { timeout: 5 })] }],
      // Exact-string matcher, not a regular expression: the value stays inside
      // the letters/digits/_/-/space/,/| set so it is matched exactly.
      PostToolUse: [
        { matcher: "Write|Edit|NotebookEdit", hooks: [handler("observe.mjs", { async: true })] },
      ],
      Stop: [{ hooks: [handler("notify.mjs", { timeout: 5 })] }],
    },
  };
}

function manifest({ metadata, targetConfig }) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: targetConfig.description,
    author: metadata.author,
  };
}

function marketplace({ metadata }) {
  return {
    name: metadata.name,
    owner: metadata.author,
    metadata: {
      description:
        "Architectural-decision skills for Claude Code — pick or audit software architecture, design patterns, agentic-system designs, testing strategy, and the security of a design (threat-model).",
      version: metadata.version,
    },
    plugins: [
      {
        name: metadata.name,
        source: "./build/claude",
        description: marketplaceDescription,
        version: metadata.version,
        author: { name: metadata.author.name },
        category: "software-architecture",
        keywords,
      },
    ],
  };
}

export default {
  outputDirectory: "claude",
  // `commands` is Claude-only: slash commands are a Claude Code plugin surface,
  // and Codex has no equivalent. The Markdown is copied byte-for-byte like every
  // other prose file in this package -- never rendered, never token-substituted.
  runtimeTrees: ({ packaging }) => [
    { source: packaging.canonicalSkills, destination: "skills" },
    { source: packaging.canonicalRuntime, destination: "runtime" },
    { source: packaging.canonicalCommands, destination: "commands" },
  ],
  manifestPath: ".claude-plugin/plugin.json",
  manifest,
  targetFiles: [{ path: "hooks/hooks.json", render: hooks }],
  rootFiles: [
    { path: ".claude-plugin/plugin.json", render: manifest },
    { path: ".claude-plugin/marketplace.json", render: marketplace },
  ],
};
