/**
 * Professional PDF Processor
 * Features: Merge, Split, Compress PDFs with drag-and-drop interface
 * Author: Professional Development Team
 * Version: 2.0.0
 */

class PDFProcessor {
  constructor() {
    this.files = new Map(); // Using Map for better performance and unique keys
    this.isProcessing = false;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.dragCounter = 0;
    this.compressionSettings = {
      level: 'standard', // 'standard' or 'strong'
      quality: 80
    };
    
    // Initialize the processor
    this.init();
  }

  async init() {
    try {
      console.log('🚀 Initializing PDF Processor v2.0.0');
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      this.initializeElements();
      this.bindEvents();
      this.updateUI();
      this.showReadyState();
      
      console.log('✅ PDF Processor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PDF Processor:', error);
      this.showError('Failed to initialize PDF processor. Please refresh the page.');
    }
  }

  initializeElements() {
    // Cache DOM elements
    this.elements = {
      // Upload section
      dropArea: document.getElementById('drop-area'),
      fileInput: document.getElementById('file-input'),
      browseBtn: document.getElementById('browse-btn'),
      
      // File management
      fileList: document.getElementById('file-list'),
      fileStats: document.getElementById('file-stats'),
      
      // Processing options
      pageRanges: document.getElementById('page-ranges'),
      compressionRadios: document.querySelectorAll('input[name="compression"]'),
      
      // Action buttons
      processBtn: document.getElementById('process-btn'),
      clearBtn: document.getElementById('clear-btn'),
      
      // Status and progress
      statusMessage: document.getElementById('status-message'),
      progressSection: document.getElementById('progress-section'),
      progressBar: document.getElementById('progress-bar'),
      progressText: document.getElementById('progress-text'),
      
      // Results
      downloadSection: document.getElementById('download-section'),
      downloadBtn: document.getElementById('download-btn')
    };

    // Validate critical elements
    const criticalElements = ['dropArea', 'fileInput', 'browseBtn', 'fileList'];
    const missingElements = criticalElements.filter(key => !this.elements[key]);
    
    if (missingElements.length > 0) {
      throw new Error(`Missing critical DOM elements: ${missingElements.join(', ')}`);
    }

    console.log('✅ All DOM elements initialized');
  }

  bindEvents() {
    console.log('🔗 Binding event listeners');

    // File input events
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.browseBtn.addEventListener('click', (e) => this.triggerFileSelect(e));

    // Drag and drop events
    const dragEvents = {
      dragenter: (e) => this.handleDragEnter(e),
      dragover: (e) => this.handleDragOver(e),
      dragleave: (e) => this.handleDragLeave(e),
      drop: (e) => this.handleDrop(e)
    };

    Object.entries(dragEvents).forEach(([event, handler]) => {
      this.elements.dropArea.addEventListener(event, handler);
    });

    // Keyboard accessibility
    this.elements.dropArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.triggerFileSelect(e);
      }
    });

    // Processing controls
    if (this.elements.processBtn) {
      this.elements.processBtn.addEventListener('click', () => this.processFiles());
    }
    
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => this.clearAllFiles());
    }

    // Compression settings
    this.elements.compressionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.compressionSettings.level = e.target.value;
        console.log(`📊 Compression level changed to: ${this.compressionSettings.level}`);
      });
    });

    // Page range validation
    if (this.elements.pageRanges) {
      this.elements.pageRanges.addEventListener('input', () => this.validatePageRanges());
    }

    console.log('✅ Event listeners bound successfully');
  }

  // File Selection Methods
  triggerFileSelect(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('📁 Triggering file selection dialog');
    this.elements.fileInput.click();
  }

  async handleFileSelect(e) {
    const files = Array.from(e.target.files);
    await this.processSelectedFiles(files);
    
    // Clear the input to allow selecting the same file again
    this.elements.fileInput.value = '';
  }

  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.resetDragState();
    
    const files = Array.from(e.dataTransfer.files);
    await this.processSelectedFiles(files);
  }

  async processSelectedFiles(files) {
    if (files.length === 0) return;
    
    console.log(`📄 Processing ${files.length} selected file(s)`);
    this.showStatus(`Processing ${files.length} file(s)...`, 'info');
    
    const results = await Promise.allSettled(
      files.map(file => this.addFile(file))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (successful > 0) {
      this.showStatus(`✅ Added ${successful} file(s) successfully${failed > 0 ? ` (${failed} failed)` : ''}`, 'success');
    } else if (failed > 0) {
      this.showStatus(`❌ Failed to add ${failed} file(s)`, 'error');
    }
    
    this.updateUI();
  }

  async addFile(file) {
    try {
      // Generate unique ID for the file
      const fileId = this.generateUniqueId(file);
      
      // Check if file already exists (by content, not just name)
      if (this.files.has(fileId)) {
        throw new Error(`File "${file.name}" is already in the list`);
      }
      
      // Validate file
      this.validateFile(file);
      
      // Analyze PDF
      const pdfInfo = await this.analyzePDF(file);
      
      // Create file record
      const fileRecord = {
        id: fileId,
        file: file,
        name: file.name,
        size: file.size,
        pageCount: pdfInfo.pageCount,
        title: pdfInfo.title,
        pdfDoc: pdfInfo.pdfDoc,
        isEncrypted: pdfInfo.isEncrypted,
        addedAt: new Date(),
        pageRanges: '' // User-defined page ranges
      };
      
      // Add to collection
      this.files.set(fileId, fileRecord);
      
      console.log(`✅ Added file: ${file.name} (${pdfInfo.pageCount} pages)`);
      return fileRecord;
      
    } catch (error) {
      console.error(`❌ Failed to add file "${file.name}":`, error);
      this.showStatus(`Failed to add "${file.name}": ${error.message}`, 'error');
      throw error;
    }
  }

  generateUniqueId(file) {
    // Create unique ID based on file content characteristics
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const fileHash = `${file.name}-${file.size}-${file.lastModified || timestamp}`;
    return `${fileHash}-${random}`;
  }

  validateFile(file) {
    console.log(`🔍 Validating file: ${file.name}`);
    
    // Check file type
    const isPdfByMime = file.type === 'application/pdf';
    const isPdfByExtension = file.name.toLowerCase().endsWith('.pdf');
    
    if (!isPdfByMime && !isPdfByExtension) {
      throw new Error('Only PDF files are supported');
    }
    
    // Check file size
    if (file.size === 0) {
      throw new Error('File appears to be empty');
    }
    
    if (file.size > this.maxFileSize) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      throw new Error(`File is too large (${sizeMB}MB). Maximum size is 50MB`);
    }
    
    console.log(`✅ File validation passed: ${file.name}`);
  }

  async analyzePDF(file) {
    console.log(`🔬 Analyzing PDF: ${file.name}`);
    
    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Validate PDF header
      const header = new Uint8Array(arrayBuffer.slice(0, 8));
      const headerString = String.fromCharCode(...header);
      
      if (!headerString.startsWith('%PDF-')) {
        throw new Error('Invalid PDF file format');
      }
      
      // Load PDF-lib dynamically
      const pdfLib = await this.loadPDFLib();
      
      // Parse PDF document
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer, {
        ignoreEncryption: false
      });
      
      const pageCount = pdfDoc.getPageCount();
      const title = pdfDoc.getTitle() || file.name.replace(/\.[^/.]+$/, '');
      
      console.log(`✅ PDF analysis complete: ${pageCount} pages`);
      
      return {
        pdfDoc,
        pageCount,
        title,
        isEncrypted: false
      };
      
    } catch (error) {
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        throw new Error('Password-protected PDFs are not supported');
      }
      
      throw new Error(`Cannot process PDF: ${error.message}`);
    }
  }

  async loadPDFLib() {
    if (window.pdfLib) {
      return window.pdfLib;
    }
    
    console.log('📚 Loading PDF-lib library...');
    
    try {
      // Try primary CDN
      window.pdfLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.js');
      console.log('✅ PDF-lib loaded from unpkg');
      return window.pdfLib;
    } catch (error) {
      console.warn('⚠️ Primary CDN failed, trying fallback...');
      
      try {
        // Try fallback CDN
        window.pdfLib = await import('https://cdn.skypack.dev/pdf-lib@1.17.1');
        console.log('✅ PDF-lib loaded from skypack');
        return window.pdfLib;
      } catch (fallbackError) {
        throw new Error('Failed to load PDF processing library. Please check your internet connection.');
      }
    }
  }

  // Drag and Drop Handlers
  handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter++;
    this.elements.dropArea.classList.add('drag-over');
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter--;
    
    if (this.dragCounter <= 0) {
      this.resetDragState();
    }
  }

  resetDragState() {
    this.dragCounter = 0;
    this.elements.dropArea.classList.remove('drag-over');
  }

  // UI Update Methods
  updateUI() {
    this.updateFileList();
    this.updateStats();
    this.updateActionButtons();
  }

  updateFileList() {
    const container = this.elements.fileList;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.files.size === 0) {
      container.innerHTML = '<div class="no-files">No files added yet</div>';
      return;
    }
    
    Array.from(this.files.values()).forEach((fileRecord, index) => {
      const fileItem = this.createFileItem(fileRecord, index);
      container.appendChild(fileItem);
    });
  }

  createFileItem(fileRecord, index) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.fileId = fileRecord.id;
    
    const sizeFormatted = this.formatFileSize(fileRecord.size);
    const timeAdded = fileRecord.addedAt.toLocaleTimeString();
    
    item.innerHTML = `
      <div class="file-drag-handle">⋮⋮</div>
      <div class="file-icon">📄</div>
      <div class="file-info">
        <div class="file-name" title="${fileRecord.name}">${fileRecord.name}</div>
        <div class="file-details">${fileRecord.pageCount} pages • ${sizeFormatted} • Added ${timeAdded}</div>
        <div class="file-ranges">
          <input type="text" 
                 placeholder="Page ranges (e.g., 1-5,8,10-12)" 
                 value="${fileRecord.pageRanges}"
                 class="page-range-input"
                 data-file-id="${fileRecord.id}">
        </div>
      </div>
      <div class="file-actions">
        <button class="btn-icon" onclick="pdfProcessor.removeFile('${fileRecord.id}')" title="Remove file">
          ✕
        </button>
      </div>
    `;
    
    // Bind page range input
    const rangeInput = item.querySelector('.page-range-input');
    rangeInput.addEventListener('input', (e) => {
      fileRecord.pageRanges = e.target.value;
      this.validatePageRange(e.target, fileRecord.pageCount);
    });
    
    // Bind drag events for reordering
    this.bindFileItemDragEvents(item);
    
    return item;
  }

  bindFileItemDragEvents(item) {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.fileId);
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingItem = document.querySelector('.file-item.dragging');
      if (draggingItem && draggingItem !== item) {
        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
          item.parentNode.insertBefore(draggingItem, item);
        } else {
          item.parentNode.insertBefore(draggingItem, item.nextSibling);
        }
      }
    });
  }

  validatePageRange(input, maxPages) {
    const value = input.value.trim();
    if (!value) return true;
    
    try {
      const ranges = this.parsePageRanges(value, maxPages);
      input.classList.remove('invalid');
      input.title = '';
      return true;
    } catch (error) {
      input.classList.add('invalid');
      input.title = error.message;
      return false;
    }
  }

  parsePageRanges(rangeString, maxPages) {
    const ranges = [];
    const parts = rangeString.split(',').map(s => s.trim()).filter(s => s);
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        
        if (isNaN(start) || isNaN(end)) {
          throw new Error('Invalid page range format');
        }
        
        if (start < 1 || end > maxPages || start > end) {
          throw new Error(`Invalid range ${start}-${end}. Pages must be between 1-${maxPages}`);
        }
        
        for (let i = start; i <= end; i++) {
          ranges.push(i);
        }
      } else {
        const page = parseInt(part);
        
        if (isNaN(page) || page < 1 || page > maxPages) {
          throw new Error(`Invalid page number ${part}. Must be between 1-${maxPages}`);
        }
        
        ranges.push(page);
      }
    }
    
    return [...new Set(ranges)].sort((a, b) => a - b);
  }

  updateStats() {
    const statsElement = this.elements.fileStats;
    if (!statsElement) return;
    
    const fileCount = this.files.size;
    const totalPages = Array.from(this.files.values()).reduce((sum, f) => sum + f.pageCount, 0);
    const totalSize = Array.from(this.files.values()).reduce((sum, f) => sum + f.size, 0);
    
    statsElement.textContent = fileCount === 0 
      ? 'No files selected'
      : `${fileCount} file(s) • ${totalPages} pages total • ${this.formatFileSize(totalSize)}`;
  }

  updateActionButtons() {
    const hasFiles = this.files.size > 0;
    
    if (this.elements.processBtn) {
      this.elements.processBtn.disabled = !hasFiles || this.isProcessing;
    }
    
    if (this.elements.clearBtn) {
      this.elements.clearBtn.disabled = !hasFiles || this.isProcessing;
    }
  }

  // File Management
  removeFile(fileId) {
    if (this.files.has(fileId)) {
      const fileRecord = this.files.get(fileId);
      this.files.delete(fileId);
      console.log(`🗑️ Removed file: ${fileRecord.name}`);
      this.updateUI();
      this.showStatus(`Removed "${fileRecord.name}"`, 'info');
    }
  }

  clearAllFiles() {
    const count = this.files.size;
    this.files.clear();
    this.updateUI();
    this.hideProgress();
    this.hideDownload();
    console.log(`🗑️ Cleared all ${count} files`);
    this.showStatus(`Cleared all files`, 'info');
  }

  // Processing Methods
  async processFiles() {
    if (this.files.size === 0) {
      this.showStatus('No files to process', 'error');
      return;
    }
    
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.updateActionButtons();
    
    try {
      console.log('🔄 Starting PDF processing...');
      this.showProgress('Preparing files...');
      
      // Collect files with their page ranges
      const filesToProcess = this.getFilesForProcessing();
      
      if (filesToProcess.length === 0) {
        throw new Error('No valid page ranges specified');
      }
      
      // Merge PDFs
      this.updateProgress(20, 'Merging PDFs...');
      const mergedPdf = await this.mergePDFs(filesToProcess);
      
      // Apply compression if selected
      let finalPdf = mergedPdf;
      if (this.compressionSettings.level !== 'none') {
        this.updateProgress(60, 'Compressing PDF...');
        finalPdf = await this.compressPDF(mergedPdf);
      }
      
      // Generate download
      this.updateProgress(90, 'Preparing download...');
      const pdfBytes = await finalPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      this.updateProgress(100, 'Complete!');
      this.showDownload(blob);
      
      console.log('✅ PDF processing completed successfully');
      
    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      this.showStatus(`Processing failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
      this.updateActionButtons();
      setTimeout(() => this.hideProgress(), 2000);
    }
  }

  getFilesForProcessing() {
    return Array.from(this.files.values()).map(fileRecord => {
      let pageRanges = null;
      
      if (fileRecord.pageRanges.trim()) {
        try {
          pageRanges = this.parsePageRanges(fileRecord.pageRanges, fileRecord.pageCount);
        } catch (error) {
          console.warn(`Invalid page range for ${fileRecord.name}: ${error.message}`);
          // Use all pages if range is invalid
          pageRanges = null;
        }
      }
      
      return {
        pdfDoc: fileRecord.pdfDoc,
        name: fileRecord.name,
        pageRanges: pageRanges,
        totalPages: fileRecord.pageCount
      };
    });
  }

  async mergePDFs(filesToProcess) {
    const pdfLib = await this.loadPDFLib();
    const mergedPdf = await pdfLib.PDFDocument.create();
    
    for (const fileInfo of filesToProcess) {
      const pagesToCopy = fileInfo.pageRanges || 
        Array.from({ length: fileInfo.totalPages }, (_, i) => i + 1);
      
      // Convert to 0-based indices
      const pageIndices = pagesToCopy.map(p => p - 1);
      
      const copiedPages = await mergedPdf.copyPages(fileInfo.pdfDoc, pageIndices);
      copiedPages.forEach(page => mergedPdf.addPage(page));
      
      console.log(`📄 Merged ${pagesToCopy.length} pages from ${fileInfo.name}`);
    }
    
    return mergedPdf;
  }

  async compressPDF(pdfDoc) {
    try {
      console.log(`🗜️ Applying ${this.compressionSettings.level} compression`);
      
      const pdfBytes = await pdfDoc.save();
      
      const formData = new FormData();
      formData.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'merged.pdf');
      formData.append('level', this.compressionSettings.level);
      
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Compression service unavailable');
      }
      
      const compressedBytes = await response.arrayBuffer();
      const pdfLib = await this.loadPDFLib();
      
      return await pdfLib.PDFDocument.load(compressedBytes);
      
    } catch (error) {
      console.warn('⚠️ Compression failed, using original PDF:', error);
      return pdfDoc; // Return original if compression fails
    }
  }

  // UI Status Methods
  showStatus(message, type = 'info') {
    const statusElement = this.elements.statusMessage;
    if (!statusElement) {
      console.log(`Status: ${message}`);
      return;
    }
    
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }

  showProgress(message) {
    const section = this.elements.progressSection;
    const text = this.elements.progressText;
    
    if (section) section.style.display = 'block';
    if (text) text.textContent = message;
  }

  updateProgress(percent, message) {
    const bar = this.elements.progressBar;
    const text = this.elements.progressText;
    
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = message;
  }

  hideProgress() {
    const section = this.elements.progressSection;
    if (section) section.style.display = 'none';
  }

  showDownload(blob) {
    const section = this.elements.downloadSection;
    const button = this.elements.downloadBtn;
    
    if (!section || !button) return;
    
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `merged-pdf-${timestamp}.pdf`;
    
    button.href = url;
    button.download = filename;
    section.style.display = 'block';
    
    console.log(`📥 Download ready: ${filename}`);
  }

  hideDownload() {
    const section = this.elements.downloadSection;
    if (section) section.style.display = 'none';
  }

  showReadyState() {
    this.showStatus('PDF Processor ready. Drop files or click browse to start.', 'success');
  }

  showError(message) {
    this.showStatus(message, 'error');
  }

  // Utility Methods
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
}

// Global instance and initialization
let pdfProcessor;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePDFProcessor);
} else {
  initializePDFProcessor();
}

async function initializePDFProcessor() {
  try {
    pdfProcessor = new PDFProcessor();
    window.pdfProcessor = pdfProcessor; // Make globally accessible for debugging
  } catch (error) {
    console.error('Failed to initialize PDF Processor:', error);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFProcessor;
}
