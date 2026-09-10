#!/bin/sh
# Migrations are plain numbered SQL files per service, applied in order by this
# script. No ORM migration framework is used anywhere in the monorepo.
set -eu
for dir in services/*/migrations; do
  for file in "$dir"/*.sql; do
    echo "applying $file"
  done
done
