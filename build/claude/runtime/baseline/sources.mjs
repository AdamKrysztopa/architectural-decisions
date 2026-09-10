// The authoritative-source registry.
//
// A team designates artifacts as binding on this repository: a PRD, an
// architecture document or diagram, an engineering standard, an API contract, a
// security requirement, a selected ADR, a living architecture document, or
// anything else they choose. Drift can then say "this contradicts the API
// contract and the security requirements you designated as authoritative"
// instead of only "this contradicts a decision file".
//
// Three rules govern this module, and each one is a rule because its opposite
// is a defect this product exists to prevent:
//
//   1. NOTHING IS EVER AUTO-DESIGNATED. Designation is an explicit human act,
//      recorded with provenance. A registry that scanned docs/ and adopted what
//      it found would make every stale draft in the repository binding, which
//      is worse than having no registry at all.
//   2. CONFLICTS ARE REPORTED, NEVER RESOLVED SILENTLY. Precedence orders the
//      report; it does not make the loser disappear. A registry that silently
//      picked a winner would hide exactly the disagreement the team needs to
//      see.
//   3. NO DATABASE. The registry is a list in the one committed config file. It
//      is diffable, reviewable, and has no state that can drift out of sync
//      with the repository, because it *is* in the repository.
//
// Traceability: each source records the baseline it was last checked against
// (`checked_at`, a git ref or commit). That is what lets a report say "this
// claim rests on the API contract as of 4a91c02", rather than "as of whatever
// is on disk right now".

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { relative } from "node:path";

import { ConfigError, readConfig, resolveProjectPath, writeConfig } from "./config.mjs";
import { compileGlob } from "../drift/globs.mjs";

// The artifact kinds the requirement names, plus `other` for a team's own
// choice. The vocabulary is closed so a report can group by kind and so a typo
// is refused rather than silently becoming a new kind of one.
export const SOURCE_KINDS = [
  "prd",
  "architecture-document",
  "diagram",
  "engineering-standard",
  "api-contract",
  "security-requirement",
  "adr",
  "living-document",
  "other",
];

// Higher wins a precedence comparison. This orders the *report*; it never
// discards the loser. The ordering says: a contract two parties signed outranks
// one team's internal standard, and a security requirement outranks both,
// because being wrong about it is the most expensive.
export const DEFAULT_PRECEDENCE = {
  "security-requirement": 60,
  "api-contract": 50,
  prd: 40,
  "architecture-document": 30,
  "living-document": 30,
  adr: 30,
  "engineering-standard": 20,
  diagram: 10,
  other: 10,
};

const ID = /^[a-z0-9][a-z0-9-]*$/;

export class SourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceError";
  }
}

function requireString(raw, field, where) {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new SourceError(`${where}: '${field}' is required and must be a non-empty string`);
  }
  return value;
}

export function normalizeSource(raw, index) {
  const where = `sources[${index}]`;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SourceError(`${where} must be an object`);
  }

  const id = requireString(raw, "id", where);
  if (!ID.test(id)) throw new SourceError(`${where}: id '${id}' must be a lowercase slug`);

  const kind = requireString(raw, "kind", where);
  if (!SOURCE_KINDS.includes(kind)) {
    throw new SourceError(`${where}: kind '${kind}' is not one of ${SOURCE_KINDS.join(", ")}`);
  }

  const path = requireString(raw, "path", where);

  if (raw.precedence !== undefined && !Number.isInteger(raw.precedence)) {
    throw new SourceError(`${where}: precedence must be an integer`);
  }

  // The subjects this source is authoritative about — free slugs the team
  // chooses ("auth", "payment-api", "pii-retention"). This is the only thing
  // that makes a conflict *establishable*: two sources are in conflict when
  // they both claim the same subject. Without it the runtime would be guessing
  // from prose, which it must not do.
  const covers = raw.covers ?? [];
  if (!Array.isArray(covers) || covers.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new SourceError(`${where}: covers must be a list of non-empty strings`);
  }

  // The code this source governs, as scope globs in the same dialect a rule's
  // `scope` uses. This is what lets the drift drain say "the change you just
  // made is in code governed by the API contract you designated authoritative"
  // -- and it is why the glob is validated here, at designation time, rather
  // than discovered to be malformed during a drain.
  const scope = raw.scope ?? [];
  if (!Array.isArray(scope) || scope.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new SourceError(`${where}: scope must be a list of non-empty glob strings`);
  }
  for (const pattern of scope) {
    try {
      compileGlob(pattern, `source '${id}'`);
    } catch (error) {
      throw new SourceError(`${where}: ${error.message}`);
    }
  }

  return {
    id,
    kind,
    covers: [...covers].sort(),
    scope,
    // Source identity is (id, path). The id is stable across a rename; the path
    // is where it lives now.
    path,
    title: raw.title ?? null,
    // Provenance: who designated it, when, and on what authority. Free text,
    // because "the security review of 2026-08" is a real answer and no
    // vocabulary would have contained it.
    designated_by: raw.designated_by ?? null,
    designated_on: raw.designated_on ?? null,
    provenance: raw.provenance ?? null,
    precedence: raw.precedence ?? DEFAULT_PRECEDENCE[kind],
    // Traceability to the baseline this source was last checked against.
    checked_at: raw.checked_at ?? null,
    // The digest of the file's bytes as of `checked_at`, so "has this source
    // changed since we last reconciled against it?" is answerable offline and
    // without a git call.
    digest: raw.digest ?? null,
    notes: raw.notes ?? null,
  };
}

export function normalizeSources(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new SourceError("sources must be a list");

  const sources = raw.map((entry, index) => normalizeSource(entry, index));

  const byId = new Map();
  const byPath = new Map();
  for (const source of sources) {
    if (byId.has(source.id)) throw new SourceError(`two sources share the id '${source.id}'`);
    byId.set(source.id, source);
    // The same artifact designated twice under two ids is a registry that will
    // report a source as conflicting with itself.
    if (byPath.has(source.path)) {
      throw new SourceError(
        `sources '${byPath.get(source.path).id}' and '${source.id}' both designate ${source.path}`,
      );
    }
    byPath.set(source.path, source);
  }

  return sources;
}

export function digestOf(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

// Reads the registry and reports, per source, whether the artifact is still
// present and whether its bytes have moved since it was last checked. Never
// designates anything, never rewrites anything.
export async function loadSources(root) {
  const config = await readConfig(root);
  const sources = normalizeSources(config.sources);

  const resolved = [];
  for (const source of sources) {
    const path = resolveProjectPath(root, source.path, `sources[${source.id}].path`);
    let present = false;
    let digest = null;
    try {
      if ((await stat(path)).isFile()) {
        present = true;
        digest = digestOf(await readFile(path, "utf8"));
      }
    } catch {
      present = false;
    }

    resolved.push({
      ...source,
      absolutePath: path,
      present,
      currentDigest: digest,
      // Three distinct states, and the caller must be able to tell them apart:
      // never checked, checked and unchanged, checked and since modified.
      changedSinceChecked: source.digest === null ? null : digest !== source.digest,
    });
  }

  return { sources: resolved, config };
}

// --- mutation: add / remove / change ---------------------------------------

async function writeSources(root, sources) {
  normalizeSources(sources);
  await writeConfig(root, { sources });
  return sources;
}

export async function addSource(root, entry) {
  const { sources } = await loadSources(root);
  const bare = sources.map(strip);
  if (bare.some((source) => source.id === entry.id)) {
    throw new SourceError(`a source with id '${entry.id}' is already designated; use 'change' to edit it`);
  }
  return writeSources(root, [...bare, normalizeSource(entry, bare.length)]);
}

export async function removeSource(root, id) {
  const { sources } = await loadSources(root);
  const bare = sources.map(strip);
  if (!bare.some((source) => source.id === id)) {
    throw new SourceError(`no source with id '${id}' is designated`);
  }
  return writeSources(root, bare.filter((source) => source.id !== id));
}

export async function changeSource(root, id, changes) {
  const { sources } = await loadSources(root);
  const bare = sources.map(strip);
  const at = bare.findIndex((source) => source.id === id);
  if (at === -1) throw new SourceError(`no source with id '${id}' is designated`);

  const next = normalizeSource({ ...bare[at], ...changes }, at);
  return writeSources(root, bare.map((source, index) => (index === at ? next : source)));
}

// Records that a source was reconciled against a named baseline, pinning the
// digest of what was actually read. This is the traceability half of the
// requirement: without it a report can say a source was checked but not which
// version of it.
export async function markChecked(root, id, baseline) {
  const { sources } = await loadSources(root);
  const source = sources.find((entry) => entry.id === id);
  if (!source) throw new SourceError(`no source with id '${id}' is designated`);
  if (!source.present) throw new SourceError(`${source.path} is not present; nothing was checked`);
  return changeSource(root, id, { checked_at: baseline, digest: source.currentDigest });
}

// Drops the derived fields loadSources added, so what goes back to the config
// file is what the user wrote plus what they changed -- never a cache of
// filesystem state.
function strip(source) {
  const { absolutePath, present, currentDigest, changedSinceChecked, ...rest } = source;
  return rest;
}

// --- conflicts: reported, never resolved -----------------------------------

// Two designated sources conflict when they are both authoritative about the
// same subject and say different things. The runtime cannot read prose, so it
// does not pretend to: it reports the *structural* conflicts it can actually
// establish, and it is explicit that a semantic conflict is the human's to
// spot.
//
// What is establishable here:
//   - two sources designated over the same path (refused at normalize time);
//   - a source designated at the same path as a scope another source claims
//     exclusively -- not modelled in v1;
//   - two sources of equal precedence claiming the same `covers` subject;
//   - a source that has changed since it was last checked, which makes every
//     claim resting on it unverified rather than wrong.
export function findConflicts(sources) {
  const conflicts = [];

  const bySubject = new Map();
  for (const source of sources) {
    for (const subject of source.covers ?? []) {
      bySubject.set(subject, [...(bySubject.get(subject) ?? []), source]);
    }
  }

  for (const [subject, claimants] of [...bySubject.entries()].sort()) {
    if (claimants.length < 2) continue;
    const ranked = [...claimants].sort((left, right) => right.precedence - left.precedence);
    const top = ranked[0].precedence;
    const tied = ranked.filter((source) => source.precedence === top);

    conflicts.push({
      kind: tied.length > 1 ? "unresolvable-by-precedence" : "precedence-ordered",
      subject,
      sources: ranked.map((source) => ({ id: source.id, path: source.path, precedence: source.precedence })),
      // Even when precedence orders them, this is a REPORT and not a
      // resolution. The lower-precedence source still says what it says.
      note:
        tied.length > 1
          ? `${tied.map((source) => source.id).join(" and ")} are both authoritative about '${subject}' at the same precedence — a human must decide which governs`
          : `${ranked[0].id} outranks ${ranked.slice(1).map((source) => source.id).join(", ")} on '${subject}', but the disagreement is not resolved by that — read both`,
    });
  }

  for (const source of sources) {
    if (source.changedSinceChecked === true) {
      conflicts.push({
        kind: "stale-baseline",
        subject: source.id,
        sources: [{ id: source.id, path: source.path, precedence: source.precedence }],
        note: `${source.path} has changed since it was last checked at ${source.checked_at}; claims resting on it are unverified, not wrong`,
      });
    }
    if (!source.present) {
      conflicts.push({
        kind: "missing",
        subject: source.id,
        sources: [{ id: source.id, path: source.path, precedence: source.precedence }],
        note: `${source.path} is designated authoritative but is not in this repository`,
      });
    }
  }

  return conflicts;
}

export function relativePath(root, path) {
  const rel = relative(root, path);
  return !rel || rel.startsWith("..") ? path : rel.split("\\").join("/");
}

export { ConfigError };
