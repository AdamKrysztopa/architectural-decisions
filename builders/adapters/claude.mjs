const marketplaceDescription =
  "Three architectural-decision skills: decide-architecture (compose a software architecture stack), design-patterns (choose the right GoF / Python-idiomatic pattern), and agentic-patterns (design an LLM-agent control flow). Each branches on status — greenfield → selection interview → recommended design; refactoring → code review against the catalog → targeted improvements.";

const keywords = [
  "architecture",
  "design-patterns",
  "agentic",
  "llm-agents",
  "decision-support",
  "code-review",
  "refactoring",
  "greenfield",
  "ddd",
  "microservices",
  "gof",
  "python",
];

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
        "Architectural-decision skills for Claude Code — pick or audit software architecture, design patterns, and agentic-system designs.",
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
  runtimeTrees: ({ packaging }) => [
    { source: packaging.canonicalSkills, destination: "skills" },
  ],
  manifestPath: ".claude-plugin/plugin.json",
  manifest,
  rootFiles: [
    { path: ".claude-plugin/plugin.json", render: manifest },
    { path: ".claude-plugin/marketplace.json", render: marketplace },
  ],
};
