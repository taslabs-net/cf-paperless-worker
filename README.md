# Email to Paperless Automation Worker

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/taslabs-net/cf-paperless-worker)

A Cloudflare Worker that automatically processes email attachments and uploads them to Cloudflare R2 storage for document management systems like [paperless-ngx](https://docs.paperless-ngx.com/).

## 🚀 What This Does

This Cloudflare Worker creates an automated pipeline for document ingestion:

1. **Email Reception**: Receives emails sent to a configured address (e.g., `paperless@yourdomain.com`)
2. **Attachment Extraction**: Parses email attachments using custom MIME parsing
3. **File Upload**: Uploads attachments to Cloudflare R2 bucket
4. **Integration Ready**: Files can be synced to paperless-ngx or other document management systems

## 🏗️ Architecture

```
Email → Cloudflare Email Worker → R2 Bucket → rclone sync → Paperless → Document Management
```

### Complete Workflow:
1. **Email Reception**: User sends email with attachments to `paperless@yourdomain.com`
2. **Worker Processing**: Cloudflare Worker validates sender and extracts attachments
3. **R2 Storage**: Attachments uploaded to R2 bucket with metadata
4. **Automated Sync**: rclone script runs every 5 minutes to move files locally
5. **Paperless Processing**: Script triggers paperless consumer to process documents
6. **Document Management**: Files are OCR'd, indexed, and available in paperless

### Key Components:
- **Email Worker**: Handles authentication, MIME parsing, base64 decoding
- **R2 Bucket**: Temporary storage for file transfer
- **Sync Script**: Automated file movement and paperless triggering
- **Paperless Integration**: Solves inotify issues with direct consumer triggering

## 📋 Prerequisites

- Cloudflare account with Workers and R2 enabled
- Custom domain configured with Cloudflare
- Email routing configured for your domain

## 🚀 Quick Deploy

### Option 1: Deploy to Cloudflare Button (Recommended)

Click the "Deploy to Cloudflare" button above to automatically:
- Clone this repository to your GitHub account
- Create the necessary Cloudflare resources (Worker, R2 bucket)
- Configure email routing
- Deploy the worker

### Option 2: Manual Deployment

1. **Clone this repository**:
   ```bash
   git clone https://github.com/taslabs-net/cf-paperless-worker.git
   cd cf-paperless-worker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your settings**:
   - Edit `wrangler.toml` with your domain and bucket name
   - Edit `worker.js` to set allowed email addresses/domains

4. **Deploy**:
   ```bash
   npm run deploy
   ```

## ⚙️ Configuration

### Email Authentication

Edit the following lines in `worker.js`:

```javascript
// Allow specific email addresses
const allowedEmails = ["your-email@gmail.com", "another@email.com"];

// Allow entire domain
const isAllowedDomain = message.from.endsWith("@yourdomain.com");
```

### Domain Setup

Update `wrangler.toml`:

```toml
# Email routing - customize with your domain
[env.production]
route = { pattern = "paperless@yourdomain.com", custom_domain = true }

# R2 bucket configuration
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"
```

## 📧 Email Routing Setup

1. **Add your domain to Cloudflare**:
   - Go to Cloudflare Dashboard
   - Add your domain if not already added
   - Update nameservers

2. **Configure Email Routing**:
   - Navigate to Email → Email Routing
   - Enable Email Routing for your domain
   - Add a custom address (e.g., `paperless@yourdomain.com`)
   - Route it to your deployed worker

3. **DNS Configuration**:
   Cloudflare will automatically configure the required MX and TXT records.

## 🔧 Integration with Document Systems

### paperless-ngx Integration

To integrate with paperless-ngx, you'll need a sync mechanism to move files from R2 to paperless consume folder. This repository includes a complete example script at `rclone-sync.example.sh`.

**Key features of the sync script**:
- Moves files from R2 to paperless consume directory
- Automatically triggers paperless consumer (fixes inotify issues)
- Comprehensive logging and error handling
- Configurable paths and settings

**Setup**:
1. Copy `rclone-sync.example.sh` to your server
2. Configure the paths and R2 remote name
3. Set up rclone with your R2 credentials
4. Run manually or set up as a cron job for automation

## 🔄 Complete Automation Setup

### Option 1: Cron Job (Linux/macOS)
```bash
# Add to crontab (crontab -e)
*/5 * * * * /path/to/rclone-sync.sh
```

### Option 2: macOS LaunchAgent (Recommended for macOS)

Create a LaunchAgent for reliable automation on macOS:

**Create**: `~/Library/LaunchAgents/com.taslabs.r2-paperless-sync.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taslabs.r2-paperless-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/your/rclone-sync.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/path/to/logs/launchagent.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/logs/launchagent.error.log</string>
</dict>
</plist>
```

**Load the LaunchAgent**:
```bash
launchctl load ~/Library/LaunchAgents/com.taslabs.r2-paperless-sync.plist
launchctl start com.taslabs.r2-paperless-sync
```

**rclone Configuration**:
```bash
# Configure rclone for Cloudflare R2
rclone config

# Choose: n (new remote)
# Name: r2 (or your preferred name)
# Type: s3
# Provider: Cloudflare R2
# Access Key ID: Your R2 token
# Secret Access Key: Your R2 secret
# Endpoint: https://your-account-id.r2.cloudflarestorage.com
```

### Other Document Systems

The worker uploads files to R2 with the following metadata:
- `sender`: Email sender address
- `subject`: Email subject
- `timestamp`: Upload timestamp
- `originalSize`: File size

You can create custom sync scripts for any document management system that can process files from a directory.

## 📁 File Handling

### Supported File Types

The worker processes all email attachments, including:
- PDFs
- Office documents (Word, Excel, PowerPoint)
- Images (JPEG, PNG, etc.)
- Text files
- Archives (ZIP, etc.)

### Security Features

- **Sender Validation**: Only processes emails from authorized senders/domains
- **Filename Sanitization**: Removes invalid characters from filenames
- **Content Type Detection**: Preserves original MIME types
- **Error Handling**: Comprehensive logging for troubleshooting

## 🐛 Troubleshooting

### Check Worker Logs

View logs in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Click "Logs" tab

### Common Issues

**Email not being processed**:
- Check if sender is in allowed list
- Verify email routing configuration
- Check worker logs for errors

**Attachments not uploading**:
- Verify R2 bucket permissions
- Check worker logs for upload errors
- Ensure bucket name matches configuration

**MIME parsing issues**:
- Check logs for boundary detection
- Verify email format is standard MIME

**Files not being processed by paperless**:
- **Common Issue**: paperless inotify doesn't detect `rclone move` operations
- **Solution**: Our sync script automatically triggers `document_consumer --oneshot`
- **Manual Fix**: Run `docker compose exec webserver python manage.py document_consumer --oneshot`
- **Check**: Verify files are in the consume directory but not processed

**Sync script not running**:
- Check script permissions: `chmod +x rclone-sync.sh`
- Verify rclone is installed and configured
- Check LaunchAgent/cron logs for errors

## 📊 Monitoring

The worker provides detailed logging for:
- Email reception and sender validation
- MIME parsing progress
- File upload status
- Error conditions

## 🔒 Security Considerations

- The worker only processes emails from pre-configured senders
- All file uploads include sender metadata for auditing
- R2 bucket access is controlled by Cloudflare IAM
- No sensitive data is logged (email content is not stored)

## 🛠️ Development

### Local Development

```bash
# Start local development server
npm run dev

# Deploy to staging
wrangler deploy --env staging
```

### Testing

Send test emails to your configured address and monitor the worker logs to verify processing.

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📚 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Email Routing Documentation](https://developers.cloudflare.com/email-routing/)
- [paperless-ngx Documentation](https://docs.paperless-ngx.com/)

## 💡 Use Cases

- **Personal Document Management**: Automatically ingest receipts, invoices, and documents
- **Business Workflows**: Route vendor invoices to accounting systems
- **Archive Systems**: Bulk document processing via email
- **Backup Solutions**: Email-based document backup workflows

---

⭐ If this project helps you, please consider giving it a star!