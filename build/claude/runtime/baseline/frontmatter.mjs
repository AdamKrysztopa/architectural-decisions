// Strict subset of YAML frontmatter. Supported: top-level `key: value` scalars
// (bare or quoted with matching " or '), `key:` followed by a block list (of
// either bare/quoted string items or single-level maps with 4-space-indented
// continuation fields), and inline `["a", "b"]` string lists whose commas are
// only split outside quoted elements. Anything else — tabs, block scalars
// (`|`/`>`), anchors/aliases/tags (`&`/`*`/`%`/`@`/`` ` ``), an unterminated or
// mismatched quote, a trailing ` #comment` on an unquoted value, or a
// duplicate key/field — hard-fails with a FrontmatterError carrying a line
// number rather than silently misreading. Quoted values are taken verbatim
// (including any `#`) once their matching closing quote is found.
export class FrontmatterError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.name = "FrontmatterError";
    this.line = line;
  }
}

const KEYED = /^([A-Za-z][\w-]*):(.*)$/;
const ITEM = /^ {2}- (.*)$/;
const FIELD = /^ {4}([A-Za-z][\w-]*): ?(.*)$/;
const REJECTED_LEAD = /^[&*|>%@`]/;
const TRAILING_COMMENT = / #/;

function parseScalar(raw, line) {
  const value = raw.trim();
  if (REJECTED_LEAD.test(value)) {
    throw new FrontmatterError(`unsupported YAML construct: ${value[0]}`, line);
  }
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) throw new FrontmatterError("unterminated inline list", line);
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return splitInlineList(inner, line).map((entry) => unquote(entry.trim(), line));
  }
  return unquote(value, line);
}

// Splits an inline list's inner text on commas, but only outside quoted
// elements — so a comma inside a quoted element (`"a, b"`) stays part of that
// element instead of being treated as a separator.
function splitInlineList(inner, line) {
  const items = [];
  let current = "";
  let quote = null;

  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"' || ch === "'") && current.trim() === "") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ",") {
      items.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (quote) throw new FrontmatterError("unterminated quoted list element", line);

  items.push(current);
  return items;
}

function unquote(value, line) {
  if (value === "") throw new FrontmatterError("empty value", line);
  const lead = value[0];
  if (lead === '"' || lead === "'") {
    const closes = value.length > 1 && value.endsWith(lead);
    if (!closes) throw new FrontmatterError("unterminated or mismatched quote", line);
    const inner = value.slice(1, -1);
    if (inner.includes("\t")) throw new FrontmatterError("tabs are not supported", line);
    return inner;
  }
  if (value.includes("\t")) throw new FrontmatterError("tabs are not supported", line);
  if (TRAILING_COMMENT.test(value)) {
    throw new FrontmatterError("unsupported trailing comment", line);
  }
  return value;
}

function parseList(lines, start, fileLine) {
  const items = [];
  let index = start;
  let kind = null;

  while (index < lines.length) {
    const raw = lines[index];
    if (raw.trim() === "") { index += 1; continue; }
    const item = ITEM.exec(raw);
    if (!item) break;

    const keyed = KEYED.exec(item[1]);
    if (keyed && keyed[2].trim() !== "" && keyed[2].startsWith(" ")) {
      if (kind === "string") throw new FrontmatterError("list mixes strings and maps", fileLine(index));
      kind = "map";
      const entry = { [keyed[1]]: parseScalar(keyed[2], fileLine(index)) };
      index += 1;
      while (index < lines.length) {
        const field = FIELD.exec(lines[index]);
        if (!field) break;
        if (entry[field[1]] !== undefined) {
          throw new FrontmatterError(`duplicate field '${field[1]}'`, fileLine(index));
        }
        entry[field[1]] = parseScalar(field[2], fileLine(index));
        index += 1;
      }
      items.push(entry);
      continue;
    }

    if (kind === "map") throw new FrontmatterError("list mixes strings and maps", fileLine(index));
    kind = "string";
    items.push(parseScalar(item[1], fileLine(index)));
    index += 1;
  }

  if (items.length === 0) throw new FrontmatterError("block list has no items", fileLine(start));
  return { items, next: index };
}

export function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") throw new FrontmatterError("file does not open with '---'", 1);
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new FrontmatterError("frontmatter block is never closed", 1);

  const block = lines.slice(1, close);
  const fileLine = (index) => index + 2;
  const values = {};
  let index = 0;

  while (index < block.length) {
    const raw = block[index];
    if (raw.trim() === "") { index += 1; continue; }
    if (raw.includes("\t")) throw new FrontmatterError("tabs are not supported", fileLine(index));

    const keyed = KEYED.exec(raw);
    if (!keyed) {
      throw new FrontmatterError(`expected 'key: value' at the top level, got: ${raw.trim()}`, fileLine(index));
    }
    const [, key, rest] = keyed;
    if (values[key] !== undefined) throw new FrontmatterError(`duplicate key '${key}'`, fileLine(index));

    if (rest.trim() === "") {
      const { items, next } = parseList(block, index + 1, fileLine);
      values[key] = items;
      index = next;
      continue;
    }
    values[key] = parseScalar(rest, fileLine(index));
    index += 1;
  }

  return { values, body: lines.slice(close + 1).join("\n") };
}
