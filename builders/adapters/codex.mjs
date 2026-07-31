function manifest({ metadata, targetConfig }) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: targetConfig.description,
    author: metadata.author,
    license: metadata.license,
    skills: "./skills/",
    interface: {
      displayName: "Arch Crew",
      shortDescription: "Architecture decisions with explicit trade-offs",
      longDescription:
        "Choose or review software architectures, design patterns, LLM-agent control flows, and testing strategies, then record the decision.",
      developerName: metadata.author.name,
      category: "Developer Tools",
      capabilities: ["Interactive", "Write"],
      defaultPrompt: [
        "Choose the least architecture that meets my requirements.",
        "Review this codebase's architecture and propose targeted improvements.",
        "Design an LLM-agent control flow with explicit trade-offs.",
        "Decide which tests this project actually needs, and review the suite I already have.",
      ],
    },
  };
}

function marketplace({ metadata }) {
  return {
    name: metadata.name,
    interface: { displayName: "Arch Crew" },
    plugins: [
      {
        name: metadata.name,
        source: {
          source: "local",
          path: "./build/codex",
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Developer Tools",
      },
    ],
  };
}

export default {
  outputDirectory: "codex",
  runtimeTrees: ({ packaging }) => [
    { source: packaging.canonicalSkills, destination: "skills" },
  ],
  manifestPath: ".codex-plugin/plugin.json",
  manifest,
  rootFiles: [{ path: ".agents/plugins/marketplace.json", render: marketplace }],
};
