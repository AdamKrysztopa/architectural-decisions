import { appendFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { randomBytes } from "node:crypto";

export const QUEUE_DIRECTORY = ".arch-crew";
export const QUEUE_FILENAME = "drift-queue.jsonl";
export const NOTIFIED_FILENAME = "last-notified";

// Past this size the observer stops appending. It does not rotate, truncate, or
// warn: all three cost more than the observation is worth, and the drain's git
// lane still covers the edits that were not queued.
export const MAX_QUEUE_BYTES = 1_048_576;
export const MAX_QUEUE_LINES = 20_000;

// Bounds the *directory*, not just the live file: a crashed drain leaves a
// `.draining` slice behind, and nothing but a later successful drain removes
// it. Without a directory-wide cap, repeated crashed drains accumulate
// `.draining` files without limit, and a later drain reads all of them into
// memory at once.
export const MAX_QUEUE_DIRECTORY_BYTES = MAX_QUEUE_BYTES * 8;

const DRAINING = /^drift-queue\..+\.draining$/;

// CLAUDE_PROJECT_DIR stays at the session's project root when Claude enters a
// worktree, where the hook input's cwd follows it. One stable queue per session
// beats a queue scattered across worktrees; `drift status` prints the path it
// resolved so a mismatch is visible rather than silent.
export function resolveRoot(env = process.env, input = {}, cwd = process.cwd()) {
  return env.CLAUDE_PROJECT_DIR || input.cwd || cwd;
}

export function queueDirectory(root) {
  return join(root, QUEUE_DIRECTORY);
}

export function queuePath(root) {
  return join(queueDirectory(root), QUEUE_FILENAME);
}

// Absolute native path in, repository-relative posix path out, so a queue written
// on Windows drains identically. A path outside the root stays absolute and the
// drain reports it as out-of-tree instead of matching it against a scope.
export function toRepositoryPath(root, filePath) {
  const relativePath = relative(root, filePath);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) return filePath;
  return relativePath.split(sep).join("/");
}

async function countLines(path) {
  try {
    const text = await readFile(path, "utf8");
    return text.split("\n").filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

// Total bytes of every queue and draining-slice file, so the cap bounds the
// directory rather than only the file currently being appended to.
async function directoryBytes(root) {
  const directory = queueDirectory(root);
  let names = [];
  try {
    names = await readdir(directory);
  } catch {
    return 0;
  }
  let total = 0;
  for (const name of names) {
    if (name !== QUEUE_FILENAME && !DRAINING.test(name)) continue;
    try {
      total += (await stat(join(directory, name))).size;
    } catch {
      // Vanished mid-scan (raced with a drain or discard): nothing to add.
    }
  }
  return total;
}

export async function appendObservation(root, observation) {
  const path = queuePath(root);
  try {
    const info = await stat(path);
    if (info.size >= MAX_QUEUE_BYTES) return "at-cap";
  } catch {
    await mkdir(queueDirectory(root), { recursive: true });
  }
  if ((await directoryBytes(root)) >= MAX_QUEUE_DIRECTORY_BYTES) return "at-cap";
  await appendFile(path, `${JSON.stringify(observation)}\n`, "utf8");
  return "appended";
}

// Sums the live queue and every `.draining` slice: a crashed or overlapping
// drain leaves observations sitting in a slice, and both the Stop hook and
// `drift status` must still see them -- that is the one state most in need of
// being visible, not the one that goes quiet.
export async function countObservations(root) {
  const draining = await countDrainingObservations(root);
  return (await countLines(queuePath(root))) + draining.observations;
}

// The `.draining`-only view, so a caller (namely `drift status`) can report a
// stuck slice as a distinct number instead of folding it into one total.
export async function countDrainingObservations(root) {
  const directory = queueDirectory(root);
  let names = [];
  try {
    names = (await readdir(directory)).filter((name) => DRAINING.test(name));
  } catch {
    return { slices: 0, observations: 0 };
  }
  let observations = 0;
  for (const name of names) {
    observations += await countLines(join(directory, name));
  }
  return { slices: names.length, observations };
}

function notifiedPath(root) {
  return join(queueDirectory(root), NOTIFIED_FILENAME);
}

// The Stop hook's memory of how many observations it last announced. Without
// it, Stop fires once per assistant turn and repeats an identical banner for
// every turn of a long session in which the queue does not change.
export async function readNotifiedCount(root) {
  try {
    const text = await readFile(notifiedPath(root), "utf8");
    const count = Number(text.trim());
    return Number.isInteger(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

export async function writeNotifiedCount(root, count) {
  try {
    await mkdir(queueDirectory(root), { recursive: true });
    await writeFile(notifiedPath(root), String(count), "utf8");
  } catch {
    // A failure to record the mark just means the next turn notifies again;
    // never worth failing the hook over.
  }
}

export async function clearNotifiedCount(root) {
  try {
    await unlink(notifiedPath(root));
  } catch {
    // Already gone.
  }
}

// Rename first, then read. An interrupted drain never leaves the live queue half
// consumed, and the .draining slice is picked up by the next drain. The caller
// calls releaseDrained only after the packet has been emitted, so a crash before
// that re-reads rather than losing; the one-unlink-wide window in which a slice
// could be reported twice is the accepted cost of never losing one.
//
// The slice name carries the pid for a human skimming the directory, plus a
// random suffix so two drains that land on a recycled pid never rename onto
// the same target and silently clobber a slice a crashed drain left behind.
export async function drainQueue(root, pid = process.pid) {
  const directory = queueDirectory(root);
  const active = queuePath(root);
  let atCap = false;

  try {
    const info = await stat(active);
    atCap = info.size >= MAX_QUEUE_BYTES;
    const suffix = randomBytes(4).toString("hex");
    await rename(active, join(directory, `drift-queue.${pid}-${suffix}.draining`));
  } catch {
    // No live queue. Any .draining slice below is still processed.
  }

  let names = [];
  try {
    names = (await readdir(directory)).filter((name) => DRAINING.test(name)).sort();
  } catch {
    return { observations: [], malformed: 0, atCap, truncated: false, names: [] };
  }

  const observations = [];
  const consumed = [];
  let malformed = 0;
  let truncated = false;

  slices: for (const name of names) {
    let text;
    try {
      text = await readFile(join(directory, name), "utf8");
    } catch {
      // The slice vanished between readdir and readFile -- a concurrent drain
      // or discard already claimed it. Nothing lost: it was not ours to read,
      // so it is not ours to report or to release either.
      continue;
    }
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      if (observations.length >= MAX_QUEUE_LINES) {
        // Stop entirely, not just this slice: this slice (and every slice
        // after it, in order) is left un-consumed so the next drain picks up
        // the remainder instead of it being deleted unread.
        truncated = true;
        break slices;
      }
      let value;
      try {
        value = JSON.parse(line);
      } catch {
        malformed += 1;
        continue;
      }
      if (typeof value?.path !== "string" || typeof value?.t !== "string") {
        malformed += 1;
        continue;
      }
      observations.push(value);
    }
    consumed.push(name);
  }

  return { observations, malformed, atCap, truncated, names: consumed };
}

export async function releaseDrained(root, names = []) {
  for (const name of names) {
    try {
      await unlink(join(queueDirectory(root), name));
    } catch {
      // Already gone. Losing the slice loses nothing: decision files are the
      // only source of record.
    }
  }
}

export async function discardQueue(root) {
  const directory = queueDirectory(root);
  let names = [];
  try {
    names = await readdir(directory);
  } catch {
    return 0;
  }
  const removable = names.filter((name) => name === QUEUE_FILENAME || DRAINING.test(name));
  await releaseDrained(root, removable);
  await clearNotifiedCount(root);
  return removable.length;
}
