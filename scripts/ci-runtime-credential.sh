#!/usr/bin/env bash
#
# Make sure the deployed CMS holds a VALID Cloudflare runtime credential, and
# keep the account free of superseded tokens.
#
# Why: the runtime token used to be minted on every deploy with a 365-day TTL, so
# it (a) expired silently if no deploy happened for a year and (b) accumulated one
# token per deploy in the account. This script verifies the credential the
# repository already has, rotates it only when it is invalid or about to expire,
# and deletes the token it replaces.
#
# Inputs (env)
#   CF_BOOTSTRAP_TOKEN        account-owned token with API Tokens: Edit (the minter)
#   CF_SITES_API_TOKEN        the runtime token currently on record (optional)
#   CLOUDFLARE_ACCOUNT_ID     account id
#   CLOUDFLARE_API_TOKEN      credential for wrangler itself (the deploy credential)
#   RENEW_WITHIN_DAYS         rotate when expiry is closer than this (default 30)
#   DRY_RUN=1                 report what would happen, change nothing
#
# Called from .github/workflows/deploy.yml (every deploy) and
# .github/workflows/rotate-runtime-token.yml (scheduled safety net).

set -uo pipefail

API='https://api.cloudflare.com/client/v4'
RENEW_WITHIN_DAYS="${RENEW_WITHIN_DAYS:-30}"
DRY_RUN="${DRY_RUN:-0}"
WORKER_DIR="${WORKER_DIR:-$SCRIPT_DIR/../cms/packages/cms}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "::error::ci-runtime-credential.sh: $1"
  exit 1
}

[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || fail 'CLOUDFLARE_ACCOUNT_ID is not set'

json_field() {
  python3 -c "
import json,sys
try:
    data = json.load(sys.stdin)
except Exception:
    print('')
    sys.exit(0)
result = data.get('result') or {}
print(result.get('$1', '') or '')
" 2>/dev/null || true
}

install() {
  local token="$1"
  if [ "$DRY_RUN" = '1' ]; then
    echo "  (dry run) would install the credential on the Worker"
    return 0
  fi
  printf '%s' "$token" | (cd "$WORKER_DIR" && npx wrangler secret put CF_API_TOKEN --env production) \
    || fail 'installing CF_API_TOKEN on the Worker failed'
  printf '%s' "$CLOUDFLARE_ACCOUNT_ID" | (cd "$WORKER_DIR" && npx wrangler secret put CF_ACCOUNT_ID --env production) \
    || fail 'installing CF_ACCOUNT_ID on the Worker failed'
  echo '  credential installed on the Worker'
}

delete_token() {
  local id="$1"
  [ -n "$id" ] || return 0
  if [ "$DRY_RUN" = '1' ]; then
    echo "  (dry run) would delete the superseded token $id"
    return 0
  fi
  curl -s -X DELETE -H "Authorization: Bearer ${CF_BOOTSTRAP_TOKEN}" \
    "$API/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/${id}" >/dev/null || true
  echo "  deleted the superseded token (${id})"
}

# ---------------------------------------------------------------- 1) verify ---
CURRENT="${CF_SITES_API_TOKEN:-}"
VERIFIED_ID=''

if [ -n "$CURRENT" ]; then
  echo 'Checking the runtime credential on record'
  BODY="$(curl -s -H "Authorization: Bearer ${CURRENT}" "$API/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify")"
  STATUS="$(printf '%s' "$BODY" | json_field status)"
  EXPIRES="$(printf '%s' "$BODY" | json_field expires_on)"
  VERIFIED_ID="$(printf '%s' "$BODY" | json_field id)"
  echo "  status=${STATUS:-unknown} expires_on=${EXPIRES:-never}"

  if [ "$STATUS" = 'active' ]; then
    FRESH="$(python3 - "$EXPIRES" "$RENEW_WITHIN_DAYS" <<'PY'
import datetime, sys
expires, days = sys.argv[1], int(sys.argv[2])
if not expires:
    print('yes')
    sys.exit(0)
try:
    when = datetime.datetime.fromisoformat(expires.replace('Z', '+00:00'))
except ValueError:
    print('yes')
    sys.exit(0)
print('yes' if when - datetime.datetime.now(datetime.timezone.utc) > datetime.timedelta(days=days) else 'no')
PY
)"
    if [ "$FRESH" = 'yes' ]; then
      echo '  still valid — installing it as-is (no new token)'
      install "$CURRENT"
      exit 0
    fi
    echo "  expiring within ${RENEW_WITHIN_DAYS} days — rotating"
  else
    echo '  invalid or revoked — rotating'
  fi
else
  echo 'No runtime credential on record — minting one'
fi

# ----------------------------------------------------------------- 2) mint ---
[ -n "${CF_BOOTSTRAP_TOKEN:-}" ] || fail 'CF_BOOTSTRAP_TOKEN is not set, so a replacement token cannot be minted'
MINT_LOG="$(mktemp)"
REPLACEMENT="$(CF_BOOTSTRAP_TOKEN="${CF_BOOTSTRAP_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}" \
  node "${SCRIPT_DIR}/create-cf-token.mjs" runtime --print-token --no-expiry --prune 2>"${MINT_LOG}" \
  | sed -n 's/^__TOKEN__//p' | tail -1)"
if [ -z "$REPLACEMENT" ]; then
  tail -15 "${MINT_LOG}" | sed 's/^/    /'
  rm -f "${MINT_LOG}"
  fail 'minting a replacement runtime token failed'
fi
rm -f "${MINT_LOG}"
# --no-expiry: the credential the CMS holds must not silently lapse.
echo '  minted a replacement runtime token (no expiry)'

# ------------------------------------------------- 3) delete the old one ------
delete_token "$VERIFIED_ID"

# --------------------------------------------------------------- 4) install ---
install "$REPLACEMENT"
echo 'Runtime credential is ready.'
