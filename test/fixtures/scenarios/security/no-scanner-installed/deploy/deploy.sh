#!/bin/sh
# Deploy script, committed. It is where every credential the app sees comes
# from: the operator exports them into the environment before running it.
#
# There is no vault, no secret manager, and no rotation. `env.production` is
# passed from the operator's laptop.
set -eu

env_file=${1:-env.production}
set -a
. "./$env_file"
set +a

echo "deploying with DATABASE_URL, STRIPE_API_KEY, MAILER_TOKEN in the environment"
ssh "$DEPLOY_HOST" "systemctl restart reporting-api"
