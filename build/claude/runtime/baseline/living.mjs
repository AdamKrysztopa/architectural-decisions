// `living` documentation mode: the human record is one or several living
// architecture documents, and the machine enforcement metadata sits inside
// them, beside the prose it belongs to.
//
// This is the half of the mode split that matters. A team that keeps a living
// architecture document must not be made to maintain thirty ADR-shaped files
// so the runtime has somewhere to read `scope` and `severity` from. Here they
// maintain the document; the rules live in fenced blocks under the section
// whose prose explains them.
//
//     ## Data ownership
//
//     ```arch-decision
//     id: 1
//     status: active
//     skill: decide-architecture
//     date: 2026-09-10
//     commit: 0000000
//     ```
//
//     Services own their own tables. A cross-service read goes through the
//     owning service's API, never its database.
//
//     ```arch-rule
//     id: services-own-their-tables
//     statement: A service owns its own tables; no other service reads them directly.
//     scope: ["src/**"]
//     severity: blocking
//     verification: narrative
//     ```
//
// What comes out is a decision object *identical in shape* to the one an ADR
// file produces -- same fields, same rule objects, same validation, because it
// runs the same parseRule and parseDecisionHeader. Every downstream consumer
// (the rollup, check-rules, the drift drain, rule injection) is unchanged and
// cannot tell which mode produced its input. That is the design constraint,
// not an implementation accident: the machine layer does not vary by mode.
//
// A section with no blocks is ordinary prose and is ignored. The document is
// the human's to write; only the fenced blocks are ours to read.

import { readFile } from "node:fs/promises";

import { FrontmatterError, parseFrontmatter } from "./frontmatter.mjs";
import { parseDecisionHeader, parseRule } from "./decisions.mjs";

export const DECISION_BLOCK = "arch-decision";
export const RULE_BLOCK = "arch-rule";

const HEADING = /^##[ \t]+(.+?)[ \t]*$/;
const FENCE = /^```([a-z-]*)[ \t]*$/;

// GitHub's own heading-anchor rules, minus the collision suffix: lowercase,
// drop everything that is not a word character, space or hyphen, then one
// hyphen per remaining space. The anchor is what a decision's `filename`
// becomes in this mode, so it has to be the anchor a reader can actually click
// -- which means matching GitHub character for character. Note the
// one-space-one-hyphen rule: dropping `&` from "Auth & authz" leaves two
// spaces, and GitHub's anchor is `auth--authz`, not `auth-authz`. Collapsing
// the run would produce a link that silently does not resolve.
export function anchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s/g, "-");
}

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

// Each fenced block's body is a flat `key: value` map -- exactly the subset
// parseFrontmatter already accepts at its top level -- so it is parsed by
// wrapping it back into a frontmatter block rather than by a second parser
// that would accept a slightly different dialect of the same thing.
function parseBlock(lines, where) {
  try {
    return parseFrontmatter(["---", ...lines, "---", ""].join("\n")).values;
  } catch (error) {
    if (error instanceof FrontmatterError) fail(where, error.message);
    throw error;
  }
}

// Splits a document into level-2 sections, collecting each section's prose and
// its fenced arch-* blocks. Fenced blocks are stripped from the prose: the body
// a reader sees should be what the human wrote, not the metadata under it.
function sections(text, path) {
  const lines = text.split("\n");
  const found = [];
  let current = null;
  let fence = null;
  let block = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const at = `${path}:${index + 1}`;

    if (fence !== null) {
      if (line.trimEnd() === "```") {
        if (block) current.blocks.push({ kind: fence, lines: block, at: block.at });
        fence = null;
        block = null;
        continue;
      }
      if (block) block.push(line);
      else current.prose.push(line);
      continue;
    }

    const opening = FENCE.exec(line);
    if (opening) {
      fence = opening[1];
      if (fence === DECISION_BLOCK || fence === RULE_BLOCK) {
        if (!current) fail(at, `a \`${fence}\` block must sit under a '## ' section heading`);
        block = [];
        block.at = at;
      } else {
        // Any other fenced block is the human's -- a code sample, a diagram --
        // and passes through into the prose untouched.
        block = null;
        if (current) current.prose.push(line);
      }
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      current = { heading: heading[1], at, prose: [], blocks: [] };
      found.push(current);
      continue;
    }

    if (current) current.prose.push(line);
  }

  if (fence !== null) fail(path, "a fenced block is never closed");
  return found;
}

// One living document in, its decisions out. Errors are collected per section
// rather than thrown at the first bad one, so a document with two broken rules
// reports both instead of hiding the second behind the first.
export function parseLivingDocument(text, path) {
  const decisions = [];
  const errors = [];

  for (const section of sections(text, path)) {
    const headers = section.blocks.filter((entry) => entry.kind === DECISION_BLOCK);
    const rules = section.blocks.filter((entry) => entry.kind === RULE_BLOCK);
    if (headers.length === 0 && rules.length === 0) continue;

    const where = `${path}#${anchor(section.heading)}`;

    try {
      if (headers.length === 0) {
        fail(
          where,
          `section '${section.heading}' declares ${rules.length} \`${RULE_BLOCK}\` block(s) but no ` +
            `\`${DECISION_BLOCK}\` block — a rule has to belong to a decision that can be superseded`,
        );
      }
      if (headers.length > 1) {
        fail(where, `section '${section.heading}' declares ${headers.length} \`${DECISION_BLOCK}\` blocks; expected one`);
      }

      const header = parseDecisionHeader(parseBlock(headers[0].lines, headers[0].at), where);
      decisions.push({
        ...header,
        slug: anchor(section.heading),
        title: section.heading,
        body: `# ${section.heading}\n${section.prose.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`,
        rules: rules.map((entry) => parseRule(parseBlock(entry.lines, entry.at), header.id, where)),
        filename: where,
        document: path,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  return { decisions, errors };
}

// `promote` in living mode. Flips exactly one `arch-decision` block's status
// from proposed to active, in place, leaving every byte of the human's prose
// alone -- the same explicit human act promotion is in `adr` mode, applied to
// the other place a decision can live. Returns null when this document does
// not declare the id, so the caller can look in the next one.
export function promoteInDocument(text, id, path) {
  const lines = text.split("\n");
  let fence = null;
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence === null) {
      const opening = FENCE.exec(line);
      if (opening) {
        fence = opening[1];
        start = index + 1;
      }
      continue;
    }
    if (line.trimEnd() !== "```") continue;

    if (fence === DECISION_BLOCK) {
      const block = lines.slice(start, index);
      const declared = block.find((entry) => /^id:\s/.test(entry));
      if (declared && Number(declared.slice(3).trim()) === id) {
        const at = block.findIndex((entry) => /^status:\s/.test(entry));
        if (at === -1) throw new Error(`${path}: decision ${id} has no 'status' field`);
        const current = block[at].slice(7).trim();
        if (current === "active") throw new Error(`${path}: decision ${id} is already active`);
        if (current === "superseded") throw new Error(`${path}: decision ${id} is superseded and cannot be promoted`);
        lines[start + at] = "status: active";
        return lines.join("\n");
      }
    }
    fence = null;
  }

  return null;
}

// Reads every configured living document in the order the config names them.
// A missing document is an error, not an empty result: in this mode it is the
// human record, and silently treating a typo'd path as "no decisions yet"
// would report a compliant repository with no rules in it.
export async function loadLivingDocuments(paths, displayPath = (path) => path) {
  const decisions = [];
  const errors = [];

  for (const path of paths) {
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      errors.push(
        error.code === "ENOENT"
          ? `${displayPath(path)}: no such living architecture document`
          : `${displayPath(path)}: ${error.message}`,
      );
      continue;
    }
    const parsed = parseLivingDocument(text, displayPath(path));
    decisions.push(...parsed.decisions);
    errors.push(...parsed.errors);
  }

  return { decisions, errors };
}
