#!/usr/bin/env bash
# Automated Backup Script for SKE Export Documents & Realisation Tracker
# Backs up PostgreSQL database dump + storage/ directory (PDFs & documents)

set -euo pipefail

trap 'echo "[ERROR] SKE Backup encountered a fatal error on line $LINENO at $(date -u)" >&2' ERR

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/ske}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

PG_USER="${POSTGRES_USER:-ske_user}"
PG_DB="${POSTGRES_DB:-ske_export_db}"

mkdir -p "${BACKUP_DIR}"

echo "=== [SKE BACKUP START: ${TIMESTAMP}] ==="
echo "Target Backup Directory: ${BACKUP_DIR}"

# 1. Backup PostgreSQL database from running container
echo "Dumping PostgreSQL database (${PG_DB}) as user (${PG_USER})..."
docker compose exec -T postgres pg_dump -U "${PG_USER}" -d "${PG_DB}" -F c -b -v -f /tmp/ske_backup.dump
docker compose cp postgres:/tmp/ske_backup.dump "${BACKUP_DIR}/postgres_${PG_DB}_${TIMESTAMP}.dump"
docker compose exec -T postgres rm /tmp/ske_backup.dump

if [ ! -s "${BACKUP_DIR}/postgres_${PG_DB}_${TIMESTAMP}.dump" ]; then
    echo "ERROR: PostgreSQL dump is empty or missing!" >&2
    exit 1
fi

# 2. Backup storage/ directory (PDF files, OCR staging, audit records)
echo "Archiving document storage files..."
if [ -d "storage" ]; then
    tar -czf "${BACKUP_DIR}/storage_archive_${TIMESTAMP}.tar.gz" storage
elif [ -d "/app/storage" ]; then
    tar -czf "${BACKUP_DIR}/storage_archive_${TIMESTAMP}.tar.gz" -C /app storage
elif docker volume inspect ske_storage >/dev/null 2>&1; then
    docker run --rm -v ske_storage:/storage:ro -v "${BACKUP_DIR}":/backup alpine tar -czf "/backup/storage_archive_${TIMESTAMP}.tar.gz" -C / storage
fi

# 3. Create SHA256 checksum manifest
echo "Generating SHA256 checksum manifest..."
(
    cd "${BACKUP_DIR}"
    rm -f SHA256SUMS.txt
    sha256sum * > SHA256SUMS.txt
)

# 4. Verify checksum manifest immediately
echo "Validating generated checksums..."
(
    cd "${BACKUP_DIR}"
    sha256sum -c SHA256SUMS.txt
)

# 5. Clean up backups older than RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + || true

echo "=== [SKE BACKUP COMPLETED: ${BACKUP_DIR}] ==="
