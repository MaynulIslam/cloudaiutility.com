const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create temp directory if it doesn't exist
const TEMP_DIR = path.join(__dirname, 'temp');
const ensureTempDir = async () => {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureTempDir();
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Compression profiles
const COMPRESSION_PROFILES = {
  standard: [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    '-dPDFSETTINGS=/printer',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true'
  ],
  strong: [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/ebook',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dColorImageDownsampleType=/Bicubic',
    '-dColorImageResolution=150',
    '-dGrayImageDownsampleType=/Bicubic',
    '-dGrayImageResolution=150',
    '-dMonoImageDownsampleType=/Bicubic',
    '-dMonoImageResolution=150'
  ]
};

// Compression endpoint
app.post('/api/compress-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const { level = 'standard' } = req.body;
  const inputPath = req.file.path;
  const outputPath = path.join(TEMP_DIR, `compressed-${uuidv4()}.pdf`);

  try {
    // Validate compression level
    if (!COMPRESSION_PROFILES[level]) {
      throw new Error(`Invalid compression level: ${level}`);
    }

    // Check if Ghostscript is available
    const gsCommand = process.platform === 'win32' ? 'gswin64c' : 'gs';
    
    await compressPDF(gsCommand, inputPath, outputPath, level);

    // Get file stats
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);
    
    const compressionRatio = Math.round((1 - outputStats.size / inputStats.size) * 100);

    // Send compressed file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.setHeader('X-Original-Size', inputStats.size);
    res.setHeader('X-Compressed-Size', outputStats.size);
    res.setHeader('X-Compression-Ratio', compressionRatio);

    const fileStream = require('fs').createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up files after sending
    fileStream.on('end', async () => {
      try {
        await fs.unlink(inputPath);
        await fs.unlink(outputPath);
      } catch (err) {
        console.error('Error cleaning up files:', err);
      }
    });

  } catch (error) {
    console.error('Compression error:', error);
    
    // Clean up input file
    try {
      await fs.unlink(inputPath);
    } catch (err) {
      console.error('Error cleaning up input file:', err);
    }

    // Try to clean up output file if it exists
    try {
      await fs.unlink(outputPath);
    } catch (err) {
      // Output file might not exist, ignore error
    }

    res.status(500).json({ 
      error: 'PDF compression failed',
      details: error.message 
    });
  }
});

// Utility function to compress PDF using Ghostscript
function compressPDF(gsCommand, inputPath, outputPath, level) {
  return new Promise((resolve, reject) => {
    const args = [
      ...COMPRESSION_PROFILES[level],
      `-sOutputFile=${outputPath}`,
      inputPath
    ];

    const gs = spawn(gsCommand, args);
    
    let stderr = '';
    
    gs.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gs.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Ghostscript failed with code ${code}: ${stderr}`));
      }
    });

    gs.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error('Ghostscript not found. Please install Ghostscript to enable PDF compression.'));
      } else {
        reject(err);
      }
    });
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: {
      compression: true,
      ghostscript: checkGhostscriptAvailable()
    }
  });
});

// Check if Ghostscript is available
function checkGhostscriptAvailable() {
  return new Promise((resolve) => {
    const gsCommand = process.platform === 'win32' ? 'gswin64c' : 'gs';
    const gs = spawn(gsCommand, ['--version']);
    
    gs.on('close', (code) => {
      resolve(code === 0);
    });
    
    gs.on('error', () => {
      resolve(false);
    });
  });
}

// Cleanup old temp files (run every 30 minutes)
const cleanupTempFiles = async () => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > thirtyMinutes) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old temp file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error during temp file cleanup:', error);
  }
};

// Set up periodic cleanup
setInterval(cleanupTempFiles, 30 * 60 * 1000); // Every 30 minutes

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  await ensureTempDir();
  console.log(`PDF Processing Server running on port ${PORT}`);
  console.log(`Temp directory: ${TEMP_DIR}`);
  
  // Check Ghostscript availability
  const gsAvailable = await checkGhostscriptAvailable();
  console.log(`Ghostscript available: ${gsAvailable}`);
  
  if (!gsAvailable) {
    console.warn('WARNING: Ghostscript not found. PDF compression will not work.');
    console.warn('Install Ghostscript from: https://www.ghostscript.com/download/gsdnld.html');
  }
});
