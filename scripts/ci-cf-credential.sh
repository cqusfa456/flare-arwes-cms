#!/usr/bin/env bash
#
# Resolve ONE Cloudflare credential for a workflow run and export it.
#
# Called by every workflow that talks to Cloudflare (deploy, deploy-site,
# bootstrap). Credentials are tried in this order:
#
#   CF_BOOTSTRAP_TOKEN — PREFERRED. A user-scoped token whose only permission is
#                        "API Tokens: Write" (`node scripts/set-cf-token.mjs
#                        bootstrap`). Each run uses it to mint a short-lived
#                        deploy token with exactly the permissions the deploy
#                        needs — including Pages, which the dashboard's
#                        pre-filled form cannot express. Nothing else has to be
#                        created or rotated by hand, and the minted token dies
#                        with its TTL (CI_TOKEN_TTL_DAYS, default 1).
#   CF_REFRESH_TOKEN   — the OAuth refresh token from `node scripts/oauth-login.mjs`.
#                        Only usable ONCE (Cloudflare rotates it on exchange and a
#                        run cannot store the replacement), so it is a one-off
#                        fallback for a single deploy, not a mechanism.
#   CF_API_TOKEN       — a long-lived API token (`node scripts/set-cf-token.mjs ci`).
#                        Still supported: a token created that way, or minted from
#                        the bootstrap token once and kept, works for every run.
#
# The OAuth path wins when CF_REFRESH_TOKEN is set; delete that secret to go back
# to CF_API_TOKEN. The value is masked and exported as CF_CREDENTIAL (with
# CF_CREDENTIAL_SOURCE naming which path produced it) through GITHUB_ENV, so it
# is available to later steps as ${{ env.CF_CREDENTIAL }}.
#
# ⚠ The OAuth refresh token is SINGLE USE. Cloudflare rotates it on every
# exchange, and a run that uses it cannot store the replacement (that would need
# a credential with repository-secrets write). So the stored token works for
# exactly one run and the next run fails with invalid_grant — as happened here
# (run #57 consumed it, the following runs could not). Worse, re-presenting an
# already-rotated token trips reuse detection and revokes the whole token family.
#
# Use the OAuth path for a one-off deploy, not as the permanent mechanism:
# prefer a long-lived CF_API_TOKEN (node scripts/set-cf-token.mjs ci), which also
# lets the deploy mint the Worker's scoped runtime credential. To make the OAuth
# path sustainable, add a repository secret holding a PAT with secrets:write and
# persist the rotated refresh token from the workflow — deliberately not done by
# default, because CI would then hold a credential that can rewrite every secret.
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1) Preferred: mint a short-lived deploy token on demand from the bootstrap
#    token — a user-scoped token whose ONLY permission is "API Tokens: Write".
#    Minting through the API (rather than the dashboard form) also covers the
#    permissions Cloudflare publishes no template key for, Pages in particular,
#    so nothing has to be added by hand. The minted token is scoped to the
#    deploy's own permissions and disappears with its TTL.
if [ -n "${CF_BOOTSTRAP_TOKEN:-}" ]; then
  echo "Minting an on-demand deploy token from CF_BOOTSTRAP_TOKEN"
  MINT_LOG="$(mktemp)"
  CREDENTIAL="$(CF_BOOTSTRAP_TOKEN="${CF_BOOTSTRAP_TOKEN}" CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-}" \
    node "${SCRIPT_DIR}/create-cf-token.mjs" ci --print-token --ttl-days "${CI_TOKEN_TTL_DAYS:-1}" --prune 2>"${MINT_LOG}" \
    | sed -n 's/^__TOKEN__//p' | tail -1)"
  if [ -n "${CREDENTIAL}" ]; then
    SOURCE="bootstrap mint"
  else
    # Never swallow this: a silent failure here is what let a run fall back to a
    # revoked token and fail later with an unrelated-looking auth error.
    echo "::warning::CF_BOOTSTRAP_TOKEN could not mint a deploy token; falling back. Reason:"
    tail -15 "${MINT_LOG}" | sed 's/^/    /'
  fi
  rm -f "${MINT_LOG}"
fi

if [ -z "${CREDENTIAL}" ] && [ -n "${CF_REFRESH_TOKEN:-}" ]; then
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
