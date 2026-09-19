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

import { canClassify } from "../baseline/record.mjs";
import { countObservations, readNotifiedCount, resolveRoot, writeNotifiedCount } from "./queue.mjs";
import { constitutionIsStale } from "./staleness.mjs";

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
  const lastNotified = await readNotifiedCount(root);

  // The queue notice is deduped on the observation count. The staleness notice
  // is deliberately subordinate to it: it is only computed, and only shown, on a
  // turn that already has something to say. That keeps Stop off the decisions
  // directory on every ordinary turn -- the same budget discipline observe.mjs
  // holds itself to -- and it costs nothing real, because the edits that make a
  // constitution stale are exactly the edits that put something in the queue.
  // A stale constitution with an empty queue is reported by `arch constitution
  // --check`, which is the lane that exists to report it loudly.
  // With nothing to classify against, the queue notice stays silent rather than
  // becoming a one-time hint: SessionStart already says, once per session, that
  // no constitution exists, and a drain run by hand still consumes the queue and
  // proposes seeding. The check costs one stat, and only on a turn that would
  // otherwise notify.
  const notices = [];
  if (observed > 0 && observed !== lastNotified && (await canClassify(root))) {
    notices.push(
      `${observed} edit${observed === 1 ? "" : "s"} observed this session. Run /arch-crew:drift to classify them against the active rules.`,
    );
  }
  if (notices.length > 0 && (await constitutionIsStale(root))) {
    notices.push("The committed constitution is stale. Run /arch-crew:constitution to regenerate it.");
  }
  if (notices.length === 0) return;

  if (observed > 0) await writeNotifiedCount(root, observed);

  process.stdout.write(`${JSON.stringify({ systemMessage: `arch-crew: ${notices.join(" ")}` })}\n`);
}

main().catch(() => {}).finally(() => {
  process.exitCode = 0;
});
