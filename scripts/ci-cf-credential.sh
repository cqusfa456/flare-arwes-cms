#!/usr/bin/env bash
#
# Resolve ONE Cloudflare credential for a workflow run and export it.
#
# Called by every workflow that talks to Cloudflare (deploy, deploy-site,
# bootstrap). Two kinds of credential can drive them:
#
#   CF_REFRESH_TOKEN — the OAuth refresh token from `node scripts/oauth-login.mjs`
#                      (stored as a repository secret). It is exchanged for a
#                      fresh one-hour access token on every run, so unlike
#                      storing an access token there is no hourly expiry. It
#                      carries workers/d1/kv/pages write and zone read, which is
#                      everything the deploys need, but it can NOT mint API
#                      tokens or touch R2.
#   CF_API_TOKEN     — a long-lived API token (`node scripts/set-cf-token.mjs ci`).
#
# The OAuth path wins when CF_REFRESH_TOKEN is set; delete that secret to go back
# to CF_API_TOKEN. The value is masked and exported as CF_CREDENTIAL (with
# CF_CREDENTIAL_SOURCE naming which path produced it) through GITHUB_ENV, so it
# is available to later steps as ${{ env.CF_CREDENTIAL }}.
#
# Usage (in a workflow step):
#   env:
#     CF_REFRESH_TOKEN: ${{ secrets.CF_REFRESH_TOKEN }}
#     CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
#   run: bash scripts/ci-cf-credential.sh

set -uo pipefail

if [ -z "${GITHUB_ENV:-}" ]; then
  echo "::error::GITHUB_ENV is not set — run this inside GitHub Actions, or set the credential inline locally."
  exit 1
fi

CREDENTIAL=""
SOURCE="none"
OAUTH_CLIENT_ID="${OAUTH_CLIENT_ID:-54d11594-84e4-41aa-b438-e81b8fa78ee7}"

if [ -n "${CF_REFRESH_TOKEN:-}" ]; then
  echo "Exchanging CF_REFRESH_TOKEN for a fresh OAuth access token"
  CREDENTIAL="$(curl -s --max-time 60 -X POST https://dash.cloudflare.com/oauth2/token \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode grant_type=refresh_token \
    --data-urlencode "refresh_token=${CF_REFRESH_TOKEN}" \
    --data-urlencode "client_id=${OAUTH_CLIENT_ID}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null || true)"
  if [ -n "${CREDENTIAL}" ]; then
    SOURCE="oauth refresh"
  else
    echo "::warning::CF_REFRESH_TOKEN could not be exchanged (revoked?); falling back to CF_API_TOKEN."
  fi
fi

if [ -z "${CREDENTIAL}" ] && [ -n "${CF_API_TOKEN:-}" ]; then
  CREDENTIAL="${CF_API_TOKEN}"
  SOURCE="CF_API_TOKEN"
fi

if [ -z "${CREDENTIAL}" ]; then
  echo "::error::No usable Cloudflare credential. Set CF_API_TOKEN (node scripts/set-cf-token.mjs ci) or CF_REFRESH_TOKEN (node scripts/oauth-login.mjs)."
  exit 1
fi

echo "::add-mask::${CREDENTIAL}"
{
  echo "CF_CREDENTIAL=${CREDENTIAL}"
  echo "CF_CREDENTIAL_SOURCE=${SOURCE}"
} >> "${GITHUB_ENV}"

echo "Using the ${SOURCE} credential"
