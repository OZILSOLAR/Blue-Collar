#!/usr/bin/env bash
#
# verify-setup.sh — BlueCollar development environment smoke test.
#
# Checks:
#   1. Required tools are on $PATH
#   2. API responds on /health
#   3. DB + Redis are reachable via /ready
#   4. Public endpoint (/api/categories) returns data
#   5. App dev server responds (if running)
#
# Usage:
#   bash scripts/verify-setup.sh
#
# Exit codes:
#   0  — all checks pass
#   1  — one or more checks failed

set -euo pipefail

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

# ─── Tool checks ────────────────────────────────────────────────────────────────

echo ""
echo "==> Checking required tools..."

for tool in node pnpm docker cargo rustc; do
  if command -v "$tool" &>/dev/null; then
    pass "$tool is installed ($($tool --version 2>&1 | head -1))"
  else
    fail "$tool is NOT installed or not on PATH"
  fi
done

# ─── API health check ───────────────────────────────────────────────────────────

echo ""
echo "==> Checking API..."

API_BASE="${API_BASE:-http://localhost:3000}"

if health=$(curl -sf "$API_BASE/health" 2>/dev/null); then
  pass "API /health returned: $health"
else
  fail "API /health — is the API running on $API_BASE?"
fi

# ─── Readiness check (DB + Redis) ────────────────────────────────────────────────

if ready=$(curl -sf "$API_BASE/ready" 2>/dev/null); then
  status=$(echo "$ready" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  if [ "$status" = "ok" ]; then
    pass "API /ready — DB + Redis reachable"
  else
    fail "API /ready — status: $status (check DB and Redis)"
  fi
else
  fail "API /ready — is the API running?"
fi

# ─── Categories endpoint ─────────────────────────────────────────────────────────

echo ""
echo "==> Checking public API..."

if categories=$(curl -sf "$API_BASE/api/categories" 2>/dev/null); then
  count=$(echo "$categories" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data.get('data', data)))" 2>/dev/null || echo "unknown")
  pass "/api/categories returned data (count: $count)"
else
  fail "/api/categories — is the database seeded?"
fi

# ─── App check ───────────────────────────────────────────────────────────────────

echo ""
echo "==> Checking frontend..."

APP_BASE="${APP_BASE:-http://localhost:3001}"

if curl -sf -o /dev/null "$APP_BASE" 2>/dev/null; then
  pass "App is running on $APP_BASE"
else
  echo "  ~ App not detected on $APP_BASE (optional — start with: cd packages/app && pnpm dev)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────────

echo ""
echo "─── Results ───"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  Some checks failed. Review the messages above."
  echo "  Refer to docs/DEVELOPER_ONBOARDING.md for setup instructions."
  exit 1
fi

echo "  All checks passed — your environment is ready!"
exit 0
