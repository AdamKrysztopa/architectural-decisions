#!/usr/bin/env node

// Stop hook. One line to the user when the queue is non-empty, and silence
// otherwise. It must exit 0: exit 2 on Stop prevents the turn from ending. And
// systemMessage is the only legal delivery -- Stop does not add plain stdout to
// the model's context, and Stop's additionalContext keeps the conversation going.
//
// Stop fires once per assistant turn, not once per checkpoint. Without a memory
// of what it last said, a session that holds a long conversation after one
// edit would see the same banner repeated on every turn. `last-notified` records
// the observation count as of the last banner; the hook stays quiet until that
// count changes, and a drain or `discard` clears the mark along with the queue.

import { countObservations, readNotifiedCount, resolveRoot, writeNotifiedCount } from "./queue.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let input = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    // Fall through to the resolved root.
  }

  const root = resolveRoot(process.env, input, process.cwd());
  const observed = await countObservations(root);
  if (observed === 0) return;

  const lastNotified = await readNotifiedCount(root);
  if (observed === lastNotified) return;
  await writeNotifiedCount(root, observed);

  process.stdout.write(
    `${JSON.stringify({
      systemMessage: `arch-crew: ${observed} edit${observed === 1 ? "" : "s"} observed this session. Run the drift drain to classify them against the active rules.`,
    })}\n`,
  );
}

main().catch(() => {}).finally(() => {
  process.exitCode = 0;
});
