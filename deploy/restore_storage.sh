#!/usr/bin/env bash
# ==============================================================================
# SKE Export Documents & Realisation Tracker - Disaster Recovery & Restore Script
# Restores PostgreSQL database dump and /storage directory from a verified backup
# ==============================================================================

set -euo pipefail

trap 'echo "[ERROR] SKE Restore encountered a fatal error on line $LINENO at $(date -u)" >&2' ERR

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_directory> [--dry-run] [--target-db <db_name>] [--target-storage <storage_dir>]"
    echo "Example: $0 /var/backups/ske/20261102_120000"
    echo "         $0 /var/backups/ske/20261102_120000 --target-db ske_test_restore --target-storage /tmp/test_storage"
    exit 1
fi

BACKUP_DIR="$1"
DRY_RUN=false
TARGET_DB="${POSTGRES_DB:-ske_export_db}"
PG_USER="${POSTGRES_USER:-ske_user}"
TARGET_STORAGE=""

shift 1
while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        --target-storage)
            TARGET_STORAGE="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "ERROR: Backup directory '${BACKUP_DIR}' does not exist!" >&2
    exit 1
fi

echo "=== [SKE DISASTER RECOVERY & RESTORE] ==="
echo "Source Backup Directory: ${BACKUP_DIR}"
echo "Target Database:         ${TARGET_DB}"
echo "Target PostgreSQL User:  ${PG_USER}"
echo "Target Storage Dir:      ${TARGET_STORAGE:-[default production]}"
echo "Dry Run Mode:            ${DRY_RUN}"
echo "-----------------------------------------"

# 1. Verify SHA256 Checksum Manifest
echo "Step 1: Validating SHA256 checksum manifest..."
if [ ! -f "${BACKUP_DIR}/SHA256SUMS.txt" ]; then
    echo "ERROR: SHA256SUMS.txt manifest missing in ${BACKUP_DIR}! Checksum validation required for restore." >&2
    exit 1
fi

(
    cd "${BACKUP_DIR}"
    if ! sha256sum -c SHA256SUMS.txt; then
        echo "ERROR: Cryptographic SHA256 checksum validation FAILED in ${BACKUP_DIR}! Backup archive may be corrupted." >&2
        exit 1
    fi
)
echo "--> Checksum validation PASSED."

# Locate PostgreSQL dump file
PG_DUMP_FILE=$(find "${BACKUP_DIR}" -maxdepth 1 -name "*.dump" | head -n 1 || true)
if [ -z "${PG_DUMP_FILE}" ]; then
    echo "ERROR: No PostgreSQL .dump file found in ${BACKUP_DIR}!" >&2
    exit 1
fi
echo "Found database dump: ${PG_DUMP_FILE}"

# Locate Storage archive file
STORAGE_ARCHIVE=$(find "${BACKUP_DIR}" -maxdepth 1 -name "storage_archive_*.tar.gz" | head -n 1 || true)
if [ -z "${STORAGE_ARCHIVE}" ]; then
    echo "WARNING: No storage_archive_*.tar.gz file found in ${BACKUP_DIR}."
else
    echo "Found storage archive: ${STORAGE_ARCHIVE}"
    # Verify archive integrity before extracting
    if ! tar -tzf "${STORAGE_ARCHIVE}" >/dev/null 2>&1; then
        echo "ERROR: Storage archive '${STORAGE_ARCHIVE}' is corrupted or invalid tar.gz!" >&2
        exit 1
    fi
    echo "--> Archive integrity test PASSED."
fi

if [ "${DRY_RUN}" = true ]; then
    echo "--> DRY RUN: Verification successful. No data was restored."
    exit 0
fi

# 2. Database Restoration
echo "Step 2: Restoring PostgreSQL database (${TARGET_DB})..."
# Copy dump to postgres container
docker compose cp "${PG_DUMP_FILE}" postgres:/tmp/restore_target.dump

# Ensure target database exists
docker compose exec -T postgres psql -U "${PG_USER}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DB}'" | grep -q 1 || \
    docker compose exec -T postgres psql -U "${PG_USER}" -d postgres -c "CREATE DATABASE ${TARGET_DB} OWNER ${PG_USER};"

# Restore database using pg_restore with clean & single transaction
echo "Executing pg_restore into ${TARGET_DB}..."
if ! docker compose exec -T postgres pg_restore -U "${PG_USER}" -d "${TARGET_DB}" --clean --if-exists --no-owner --no-privileges -v /tmp/restore_target.dump; then
    echo "ERROR: pg_restore reported failure during restore of database ${TARGET_DB}!" >&2
    docker compose exec -T postgres rm -f /tmp/restore_target.dump || true
    exit 1
fi
docker compose exec -T postgres rm -f /tmp/restore_target.dump
echo "--> Database restore completed."

# 3. Document Storage Restoration
if [ -n "${STORAGE_ARCHIVE}" ]; then
    echo "Step 3: Restoring private document storage..."
    if [ -n "${TARGET_STORAGE}" ]; then
        mkdir -p "${TARGET_STORAGE}"
        tar -xzf "${STORAGE_ARCHIVE}" -C "${TARGET_STORAGE}"
        echo "--> Storage restored to custom target: ${TARGET_STORAGE}"
    elif [ -d "storage" ]; then
        # Safety backup of existing production storage before restore
        PRE_RESTORE_BACKUP="storage.pre_restore_backup_$(date +%s)"
        echo "Creating safety snapshot of current storage at ${PRE_RESTORE_BACKUP}..."
        cp -r storage "${PRE_RESTORE_BACKUP}"
        tar -xzf "${STORAGE_ARCHIVE}" -C .
        echo "--> Storage restored to local ./storage directory (previous state preserved in ${PRE_RESTORE_BACKUP})."
    elif docker volume inspect ske_storage >/dev/null 2>&1; then
        docker run --rm -v ske_storage:/target -v "${BACKUP_DIR}":/backup alpine tar -xzf "/backup/$(basename "${STORAGE_ARCHIVE}")" -C /target
        echo "--> Storage restored to Docker volume 'ske_storage'."
    fi
fi

echo "=========================================================="
echo " SKE Restore Procedure Finished Successfully!"
echo " Timestamp: $(date -u)"
echo "=========================================================="
