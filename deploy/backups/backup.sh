#!/usr/bin/env bash
# Encrypted PostgreSQL backup with optional S3 off-site upload.
# Usage: ./backup.sh
# Env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, PGPASSWORD,
#           BACKUP_DIR, RETENTION_DAYS, S3_BUCKET, AWS_REGION,
#           GPG_PASSPHRASE (required for encryption)

set -euo pipefail

: "${DB_HOST:=db}"
: "${DB_PORT:=5432}"
: "${DB_NAME:=bluecollar}"
: "${DB_USER:=bluecollar}"
: "${BACKUP_DIR:=/backups/postgresql}"
: "${RETENTION_DAYS:=30}"
: "${AWS_REGION:=us-east-1}"

if [[ -z "${GPG_PASSPHRASE:-}" ]]; then
  echo "ERROR: GPG_PASSPHRASE is required for encrypted backups." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%SZ)
DUMP_FILE="$BACKUP_DIR/bluecollar_${TIMESTAMP}.sql.gz"
ENC_FILE="${DUMP_FILE}.gpg"
LOG_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.log"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG_FILE"; }

log "Starting backup (db=$DB_NAME host=$DB_HOST)"

pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-password 2>>"$LOG_FILE" \
  | gzip > "$DUMP_FILE"

log "Dump complete: $(du -h "$DUMP_FILE" | cut -f1)"

# Encrypt with symmetric GPG
gpg --batch --yes --passphrase "$GPG_PASSPHRASE" \
    --symmetric --cipher-algo AES256 \
    --output "$ENC_FILE" "$DUMP_FILE"
rm -f "$DUMP_FILE"
log "Encrypted: $ENC_FILE"

# Upload to S3 if configured
if [[ -n "${S3_BUCKET:-}" ]]; then
  aws s3 cp "$ENC_FILE" "s3://${S3_BUCKET}/db-backups/" \
    --region "$AWS_REGION" --sse AES256 2>>"$LOG_FILE"
  log "Uploaded to s3://${S3_BUCKET}/db-backups/"
fi

# Enforce retention
find "$BACKUP_DIR" -name "bluecollar_*.sql.gz.gpg" -mtime "+${RETENTION_DAYS}" -delete
log "Retention: removed backups older than ${RETENTION_DAYS} days"

log "Backup finished successfully"
