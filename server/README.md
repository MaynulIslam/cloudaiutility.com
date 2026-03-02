# PDF Processing Server Setup

This server provides PDF compression functionality using Ghostscript for the Cloud AI Utility application.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Ghostscript** for PDF compression

### Installing Ghostscript

#### Windows
1. Download from: https://www.ghostscript.com/download/gsdnld.html
2. Install the 64-bit version (gswin64c)
3. Add to PATH or the server will auto-detect common installation paths

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ghostscript
```

#### macOS
```bash
brew install ghostscript
```

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

## Running the Server
http://localhost:8000/index.html
http://localhost:8000/

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 3001 by default.

## API Endpoints

### POST /api/compress-pdf
Compresses a PDF file using Ghostscript.

**Request:**
- Form data with `pdf` file and `level` parameter
- `level`: "standard" or "strong"
- Max file size: 50MB

**Response:**
- Compressed PDF file
- Headers include compression statistics

### GET /api/health
Health check endpoint that reports server status and feature availability.

## Compression Levels

### Standard
- Balanced quality and size reduction
- Suitable for general documents
- Uses `-dPDFSETTINGS=/printer`

### Strong
- Maximum compression
- Some quality loss may occur
- Uses `-dPDFSETTINGS=/ebook`
- Includes image downsampling

## Security Features

- File size limits (50MB)
- PDF-only file filter
- Temporary file cleanup (30-minute expiry)
- No persistent storage
- CORS enabled for frontend integration

## Error Handling

The server handles various error conditions:
- Invalid file types
- File size limits
- Ghostscript unavailability
- Malformed PDFs
- Processing failures

## Directory Structure

```
server/
├── package.json
├── server.js
├── temp/          (auto-created for temporary files)
└── README.md
```

## Frontend Integration

The frontend automatically detects server availability and falls back to client-side processing if the compression server is unavailable.

## Troubleshooting

### "Ghostscript not found" error
- Ensure Ghostscript is installed and in PATH
- On Windows, verify gswin64c.exe is accessible
- Check installation with: `gs --version`

### Port conflicts
- Change PORT environment variable: `PORT=3002 npm start`
- Update frontend API URL accordingly

### File permission errors
- Ensure write permissions in the server directory
- Check temp directory creation and cleanup

## Production Deployment

For production deployment:

1. Set environment variables:
```bash
export NODE_ENV=production
export PORT=3001
```

2. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name pdf-processor
```

3. Configure reverse proxy (nginx/Apache) if needed

4. Set up SSL/TLS for HTTPS

## Monitoring

The server logs important events:
- Server startup and configuration
- Ghostscript availability
- File processing operations
- Error conditions
- Cleanup operations
