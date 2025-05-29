#!/bin/bash

# R2 to Paperless Sync Script
# Syncs files from Cloudflare R2 bucket to paperless consume folder
# This script complements the email worker by moving files from R2 to your local paperless installation

# Configuration - CUSTOMIZE THESE PATHS FOR YOUR SETUP
R2_REMOTE="r2:your-bucket-name"  # Your rclone remote name and R2 bucket
CONSUME_DIR="/path/to/paperless/consume"  # Path to your paperless consume directory
LOG_FILE="/path/to/logs/r2-sync.log"  # Log file location
PAPERLESS_COMPOSE_DIR="/path/to/paperless/docker"  # Path to your paperless docker-compose directory

# Create directories if they don't exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$CONSUME_DIR"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting R2 to Paperless sync..."

# Check if consume directory exists and is writable
if [[ ! -d "$CONSUME_DIR" ]]; then
    log "ERROR: Consume directory does not exist: $CONSUME_DIR"
    exit 1
fi

if [[ ! -w "$CONSUME_DIR" ]]; then
    log "ERROR: Consume directory is not writable: $CONSUME_DIR"
    exit 1
fi

# Sync files from R2 to consume folder (move operation - deletes from R2 after successful transfer)
log "Syncing files from $R2_REMOTE to $CONSUME_DIR"

# First, check if there are any files to sync
FILE_COUNT=$(rclone lsf "$R2_REMOTE" 2>/dev/null | wc -l)

if [[ "$FILE_COUNT" -eq 0 ]]; then
    log "No files found in R2 bucket"
else
    log "Found $FILE_COUNT files to sync"
    
    # Move files from R2 to consume folder (this deletes from R2 after successful transfer)
    if rclone move "$R2_REMOTE" "$CONSUME_DIR" --progress --transfers 4 --checkers 8 2>&1 | tee -a "$LOG_FILE"; then
        log "Sync completed successfully"
        
        # Trigger paperless consumer directly since inotify doesn't work reliably with rclone move
        log "Triggering paperless consumer..."
        cd "$PAPERLESS_COMPOSE_DIR"
        if docker compose exec -T webserver python manage.py document_consumer --oneshot 2>&1 | tee -a "$LOG_FILE"; then
            log "Paperless consumer completed successfully"
        else
            log "WARNING: Paperless consumer failed"
        fi
    else
        log "ERROR: Sync failed with exit code $?"
        exit 1
    fi
fi

log "R2 to Paperless sync finished"