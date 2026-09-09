#!/usr/bin/env node

// PostToolUse hook. Registered with "async": true, so its process start is off
// the user's critical path. Budget, per edit: one stdin read, one JSON.parse,
// one stat, one append. It must never read the edited file, the constitution,
// the decisions directory, git, the network, or a model -- a trivial edit must
// never trigger a full-repository review, and that is enforced here by what this
// file is allowed to import.

import { appendObservation, resolveRoot, toRepositoryPath } from "./queue.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const input = JSON.parse(await readStdin());
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return;

  const root = resolveRoot(process.env, input, process.cwd());
  await appendObservation(root, {
    t: new Date().toISOString(),
    path: toRepositoryPath(root, filePath),
    tool: typeof input.tool_name === "string" ? input.tool_name : "unknown",
    session: typeof input.session_id === "string" ? input.session_id : "",
  });
}

// Every failure is swallowed. A hook that can break editing because a directory
// is missing is worse than no hook.
main().catch(() => {}).finally(() => {
  process.exitCode = 0;
});
