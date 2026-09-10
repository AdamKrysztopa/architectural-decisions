#!/bin/sh
# Stage this fixture as a real git repository.
#
#   ./stage.sh /path/to/empty/target
#
# The scenario's evidence has to come from git, not from the run's assertions,
# so the history is built here rather than described in prose. Author,
# committer and dates are pinned, so the same nine commits and the same hashes
# come out on every machine.
#
# The result: HEAD~6 is the commit that deleted src/legacy/gateway, which is
# the path the active rule `gateway-owns-translation` still names.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target=${1:?usage: stage.sh <target directory>}

mkdir -p "$target"
[ -z "$(ls -A "$target" 2>/dev/null)" ] || { echo "target is not empty: $target" >&2; exit 1; }

GIT_AUTHOR_NAME="Fixture"; GIT_AUTHOR_EMAIL="fixture@example.invalid"
GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"; GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

commit() { # commit <n> <message>
  d="2026-08-0$1T09:00:00+00:00"
  GIT_AUTHOR_DATE="$d" GIT_COMMITTER_DATE="$d" git -C "$target" commit -q -m "$2"
}

git -C "$target" init -q -b main

# 1 - the repository as it was, gateway present, 0001 active and true of it.
mkdir -p "$target/src/domain" "$target/src/legacy"
cp -R "$here/_history/src/legacy/gateway" "$target/src/legacy/gateway"
cp "$here/src/domain/order.py" "$target/src/domain/order.py"
mkdir -p "$target/docs/architecture/decisions"
cp "$here/docs/architecture/decisions/0001-gateway-isolation.md" "$target/docs/architecture/decisions/"
printf '# edge-service\n\nProtocol translation lives in src/legacy/gateway.\n' > "$target/README.md"
git -C "$target" add -A && commit 1 "Import the service as it stands"

# 2 - the edge router is written beside the gateway.
mkdir -p "$target/src/edge"
cp "$here/src/edge/router.py" "$target/src/edge/router.py"
git -C "$target" add -A && commit 2 "Add the edge router beside the gateway"

# 3 - the last caller moves, and the gateway package is deleted. HEAD~6.
git -C "$target" rm -r -q src/legacy/gateway
rmdir "$target/src/legacy" 2>/dev/null || true
cp "$here/README.md" "$target/README.md"
git -C "$target" add -A && commit 3 "Delete src/legacy/gateway; the edge router took the last endpoint"

# 4..9 - six ordinary commits after the deletion.
cp "$here/src/edge/retries.py" "$target/src/edge/retries.py"
git -C "$target" add -A && commit 4 "Add the outbound retry policy"

cp "$here/docs/architecture/decisions/0002-edge-router.md" "$target/docs/architecture/decisions/"
git -C "$target" add -A && commit 5 "Record the edge router decision"

printf '\nROUTE_PREFIX = "/v1"\n' >> "$target/src/edge/router.py"
git -C "$target" add -A && commit 6 "Pin the route prefix"

printf '\nMAX_BODY_BYTES = 1048576\n' >> "$target/src/edge/router.py"
git -C "$target" add -A && commit 7 "Cap the request body size"

printf '\nJITTER = 0.05\n' >> "$target/src/edge/retries.py"
git -C "$target" add -A && commit 8 "Add jitter to the backoff"

cp "$here/.gitignore" "$target/.gitignore"
cp "$here/docs/architecture/constitution.md" "$target/docs/architecture/constitution.md"
git -C "$target" add -A && commit 9 "Roll up the constitution"

# The observed edits the drain will drain. Ignored by git, as they are in a
# real checkout, so they do not show up as a changed path against HEAD.
mkdir -p "$target/.arch-crew"
cp "$here/.arch-crew/drift-queue.jsonl" "$target/.arch-crew/drift-queue.jsonl"

echo "staged: $target"
echo "deletion commit: $(git -C "$target" rev-parse --short HEAD~6)  (HEAD~6)"
git -C "$target" log --oneline --diff-filter=D --name-only -- src/legacy/gateway
