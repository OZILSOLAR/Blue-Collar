#!/usr/bin/env bash
# Restore-to-scratch drill: decrypt latest backup, restore into a temporary
# database, verify table count, then tear down.
# Usage: ./restore-drill.sh [backup_file.sql.gz.gpg]
# Env vars: DB_HOST, DB_PORT, DB_USER, PGPASSWORD, GPG_PASSPHRASE,
#           BACKUP_DIR, DRILL_DB (temp db name)

set -euo pipefail

: "${DB_HOST:=db}"
: "${DB_PORT:=5432}"
: "${DB_USER:=bluecollar}"
: "${BACKUP_DIR:=/backups/postgresql}"
: "${DRILL_DB:=bluecollar_drill}"

if [[ -z "${GPG_PASSPHRASE:-}" ]]; then
  echo "ERROR: GPG_PASSPHRASE is required." >&2
  exit 1
fi

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# Resolve backup file
BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/bluecollar_*.sql.gz.gpg 2>/dev/null | head -1)
fi
if [[ -z "$BACKUP_FILE" ]]; then
  echo "ERROR: No backup file found in $BACKUP_DIR" >&2; exit 1
fi

log "Restore drill using: $BACKUP_FILE"

# Decrypt to temp file
DECRYPTED=$(mktemp /tmp/bluecollar_drill_XXXXXX.sql.gz)
trap 'rm -f "$DECRYPTED"' EXIT

gpg --batch --yes --passphrase "$GPG_PASSPHRASE" \
    --decrypt --output "$DECRYPTED" "$BACKUP_FILE"
log "Decrypted successfully"

# Verify gzip integrity
gzip -t "$DECRYPTED"
log "Gzip integrity: OK"

# Drop & recreate drill database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
  -c "DROP DATABASE IF EXISTS $DRILL_DB;" 2>/dev/null || true
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
  -c "CREATE DATABASE $DRILL_DB;"
log "Drill database created: $DRILL_DB"

# Restore
gunzip -c "$DECRYPTED" | psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DRILL_DB" \
  > /dev/null 2>&1
log "Restore complete"

# Verify: count public tables
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DRILL_DB" \
  -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [[ "$TABLE_COUNT" -lt 1 ]]; then
  log "FAIL: No tables found in restored database"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
    -c "DROP DATABASE IF EXISTS $DRILL_DB;" 2>/dev/null || true
  exit 1
fi
log "Integrity check: $TABLE_COUNT tables found — PASSED"

# Teardown
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
  -c "DROP DATABASE IF EXISTS $DRILL_DB;"
log "Drill database torn down"
log "Restore drill PASSED"
