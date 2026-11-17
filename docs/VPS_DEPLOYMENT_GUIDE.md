# SKE Export Documents & Realisation Tracker
## Self-Hosted Ubuntu VPS Deployment & Local OCR Architecture Guide

---

### 1. Executive Summary & Zero-Cloud Guarantee

The SKE Export Documents & Realisation Tracker is engineered for **100% self-hosted operation** on an Ubuntu VPS.
- **Zero Cloud APIs**: No Gemini API, OpenAI API, AWS Textract, Google Cloud Vision, Firebase, or Supabase.
- **Client Zero-Footprint**: Users access the platform via any standard web browser. No user workstation requires Tesseract, Python, or Poppler installed.
- **Local VPS Extraction Engine**: Multi-tiered pipeline combining PyMuPDF (`fitz`), Poppler utilities (`pdftoppm`), OpenCV (`cv2`), and native Tesseract OCR (`pytesseract` / Tesseract.js WASM fallback).

---

### 2. OCR & PDF Processing Pipeline Architecture

```
[ User Browser ]
       │
       ▼ (HTTPS / 50MB Limit)
[ Nginx Reverse Proxy ]
       │
       ▼ (Private Network)
[ Express API Server ]
       │
       ├──► 1. Fast Path: Digital Vector PDF Check
       │         └── PyMuPDF / pdf-parse inspects text density
       │         └── If selectable characters >= 50: Direct text extraction (10-50ms)
       │
       └──► 2. Scanned / Raster Page Fallback
                 └── Poppler / PyMuPDF renders pages at 300 DPI
                 └── OpenCV: Grayscale -> Gaussian Blur -> Otsu Adaptive Thresholding
                 └── Tesseract OCR extracts text & confidence scores (1-3s)
```

#### Pipeline Stages
1. **Validation & Isolation**: Uploaded files are validated for MIME type and stored in private server storage (`storage/FY{year}/{invoiceKey}/...`). Original files are never placed in public static folders.
2. **Asynchronous Non-Blocking Execution**: Large documents are queued as background jobs (`PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED`). The Express request lifecycle returns immediately with HTTP 202 and a job tracking ID.
3. **Safe Concurrency**: VPS worker enforces `OCR_CONCURRENCY` (default: 2 parallel jobs, configurable based on CPU cores and RAM).
4. **Candidate Staging & Data Protection**: OCR results are saved in the `ocrJobs` staging table separately from verified financial records. **Unapproved OCR data never overwrites verified ledger records**.
5. **Admin Review & Approval**: Admins review candidate values side-by-side with original document previews, edit values in form inputs, and click "Approve & Commit to Ledger".

### 3. VPS Resource Sizing & Memory Recommendations

Local OCR using PyMuPDF, OpenCV image thresholding, and Tesseract neural LSTM engines places distinct computational demands on CPU and RAM.

#### Memory Profile Breakdown
- **Base System (Ubuntu OS + Docker Engine + Nginx + PostgreSQL 16)**: ~1.0 GB to 1.2 GB RAM baseline.
- **Node.js Express Application Server**: ~120 MB to 220 MB RAM under active user traffic.
- **Digital Vector PDF Processing (Selectable text)**: < 40 MB RAM spike, 10–50 ms CPU burst.
- **Scanned / Raster PDF Processing (300 DPI rasterization + OpenCV + Tesseract)**:
  - 300 DPI A4 page rendering: ~26 MB raw RGB pixel buffer per page.
  - OpenCV adaptive Otsu binarization & deskewing: ~50–100 MB per page.
  - Tesseract OCR LSTM neural network inference: ~150–300 MB peak per active process.
  - **Total Peak RAM per concurrent OCR job**: ~400 MB to 600 MB.

#### Sizing Tiers & Recommendations

| Deployment Tier | Concurrency Profile | Recommended VPS Specs | Configuration | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Small Production (Baseline)** | 2–3 concurrent users | **4 GB RAM, 2 vCPUs** | `OCR_CONCURRENCY=1` or `2` | 4 GB is the initial production planning baseline. Prevents Linux OOM (Out Of Memory) killer during simultaneous scanned PDF uploads. |
| **Standard Production (Recommended)** | 5–10 concurrent users | **8 GB RAM, 4 vCPUs** | `OCR_CONCURRENCY=2` or `3` | Preferred for business hours with multiple accountants uploading invoices, FIRCs, and Shipping Bills simultaneously. |
| **High-Volume Batch Processing** | 10+ users, heavy document batches | **16 GB RAM, 4–8 vCPUs** | `OCR_CONCURRENCY=4` | Required if batch-uploading dozens of 300 DPI multi-page scanned statutory packets concurrently. |

---

### 4. Ubuntu VPS Automated Deployment Instructions

#### Prerequisites
- Fresh Ubuntu 22.04 LTS or 24.04 LTS VPS (Minimum 4GB RAM, 2 vCPU initial baseline; 8GB RAM recommended for multi-user OCR).
- Root or `sudo` shell access.
- Registered domain name pointing (A Record) to your VPS IP address (e.g., `exports.skenterprises.com`).

#### Step 1: Clone Repository onto the VPS
```bash
git clone https://github.com/Kottaikaruppaiya/SKE.git /opt/ske-applet
cd /opt/ske-applet
```

#### Step 2: Run the Automated VPS Provisioning Script
The automated setup script installs Docker, Docker Compose, UFW firewall rules, native Tesseract OCR, Poppler, Python 3, generates secure credentials, sets up automated nightly backups, and launches containers:
```bash
sudo chmod +x deploy/vps_setup.sh
sudo ./deploy/vps_setup.sh
```

#### Step 3: Configure Let's Encrypt SSL (Production HTTPS)
To obtain an official Let's Encrypt SSL certificate for your domain:
```bash
# 1. Stop temporary Nginx
docker compose stop nginx

# 2. Run Certbot
certbot certonly --standalone -d your-domain.com --agree-tos -m admin@your-domain.com

# 3. Symlink certificates into deployment directory
mkdir -p deploy/ssl/live
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/ssl/live/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/ssl/live/

# 4. Restart Nginx
docker compose up -d nginx
```

---

### 4. Background Job Queue & API Reference

| Endpoint | Method | Auth | Role | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `/api/ocr/jobs` | `GET` | Bearer | All | List background OCR jobs with status & concurrency |
| `/api/ocr/jobs/:id` | `GET` | Bearer | All | Retrieve candidate extracted fields for a job |
| `/api/ocr/jobs` | `POST` | Bearer | Admin | Enqueue file for asynchronous background OCR |
| `/api/ocr/jobs/:id/retry` | `POST` | Bearer | Admin | Retry failed extraction |
| `/api/ocr/jobs/:id/approve` | `POST` | Bearer | Admin | Commit reviewed candidate values to PostgreSQL |
| `/api/ocr/jobs/:id` | `DELETE` | Bearer | Admin | Dismiss or delete OCR job |
| `/api/documents/:id/download` | `GET` | Bearer | All | Stream original file with audit log |

---

### 5. Automated Backup & Disaster Recovery

- **Nightly Backup Job**: Configured in `/etc/cron.d/ske-backup` running at `02:00 AM`.
- **Target Location**: `/var/backups/ske/YYYYMMDD_HHMMSS/`
- **Contents**:
  - `postgres_ske_export_db_*.dump`: Compressed PostgreSQL binary database dump.
  - `storage_archive_*.tar.gz`: Gzip archive of all stored statutory documents.
  - `SHA256SUMS.txt`: Checksum manifest for cryptographic integrity.
- **Retention**: Automatic 14-day pruning.

To trigger an on-demand manual backup at any time:
```bash
sudo /opt/ske-applet/deploy/backup_storage.sh
```

To restore from a backup using the automated disaster recovery script:
```bash
# 1. Run a dry-run integrity verification first (verifies SHA256 checksums without modifying data)
sudo /opt/ske-applet/deploy/restore_storage.sh /var/backups/ske/<TIMESTAMP> --dry-run

# 2. Test restore into an isolated verification database (safe, does not overwrite production data)
sudo /opt/ske-applet/deploy/restore_storage.sh /var/backups/ske/<TIMESTAMP> --target-db ske_test_restore

# 3. Full production restore (restores PostgreSQL database and physical document storage with safety backup of existing storage)
sudo /opt/ske-applet/deploy/restore_storage.sh /var/backups/ske/<TIMESTAMP>
```

---

### 6. Documented Off-Server Backup Strategy

To guard against VPS hardware failure, datacenter outages, or ransomware, on-server backups (`/var/backups/ske/`) should be replicated off-server daily.

#### Option A: S3 / Cloud Object Storage via `rclone` (Recommended)
1. Install `rclone`:
```bash
sudo apt-get install -y rclone
rclone config
# Configure a remote named 'offsite-backup' (AWS S3, Cloudflare R2, Wasabi, or Google Cloud Storage)
```
2. Add automated synchronization to `/etc/cron.d/ske-backup`:
```bash
# Append to /etc/cron.d/ske-backup after local backup finishes:
15 2 * * * root rclone sync /var/backups/ske/ offsite-backup:ske-backups/ --transfers 4 --fast-list >> /var/log/ske-rclone.log 2>&1
```

#### Option B: Remote Dedicated Storage via Encrypted `rsync` over SSH
1. Configure SSH key authentication to your secondary backup server:
```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/ske_backup_key
ssh-copy-id -i /root/.ssh/ske_backup_key.pub backupuser@backupserver.example.com
```
2. Add synchronization command:
```bash
30 2 * * * root rsync -avz -e "ssh -i /root/.ssh/ske_backup_key" --delete /var/backups/ske/ backupuser@backupserver.example.com:/data/ske-vault-backups/ >> /var/log/ske-rsync.log 2>&1
```
*Note: Off-server sync requires external storage credentials provided by the organization and is documented for administrator configuration.*

