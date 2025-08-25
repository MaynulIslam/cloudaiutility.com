// Enhanced PDF processing with merge, split, and compression
// Client-side processing using pdf-lib with server-side compression API

class PDFProcessor {
  constructor() {
    this.files = [];
    this.isProcessing = false;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.dragCounter = 0;
    
    console.log('PDFProcessor constructor called');
    
    this.initializeElements();
    this.bindEvents();
    this.updateUI();
    this.showLoadingComplete();
  }

  showLoadingComplete() {
    // Visual feedback that the processor is ready
    const dropArea = this.elements.dropArea;
    if (dropArea) {
      dropArea.style.borderColor = '#28a745';
      dropArea.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
      
      setTimeout(() => {
        dropArea.style.borderColor = '';
        dropArea.style.backgroundColor = '';
      }, 2000);
    }
    
    this.showStatus('PDF Processor ready! You can now upload files.', 'success');
  }

  initializeElements() {
    this.elements = {
      dropArea: document.getElementById('drop-area'),
      fileInput: document.getElementById('file-input'),
      browseBtn: document.getElementById('browse-btn'),
      fileList: document.getElementById('file-list'),
      fileCount: document.getElementById('file-count'),
      totalSize: document.getElementById('total-size'),
      pageRanges: document.getElementById('page-ranges'),
      processBtn: document.getElementById('process-btn'),
      clearBtn: document.getElementById('clear-btn'),
      progressSection: document.getElementById('progress-section'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      progressPercent: document.getElementById('progress-percent'),
      progressDetails: document.getElementById('progress-details'),
      resultSection: document.getElementById('result-section'),
      resultDetails: document.getElementById('result-details'),
      downloadBtn: document.getElementById('download-btn'),
      status: document.getElementById('status')
    };

    // Debug: Check if critical elements exist
    const criticalElements = ['dropArea', 'fileInput', 'browseBtn'];
    for (const elementName of criticalElements) {
      if (!this.elements[elementName]) {
        console.error(`Critical element missing: ${elementName}`);
        this.showStatus(`Error: Missing element ${elementName}`, 'error');
      } else {
        console.log(`✓ Found element: ${elementName}`);
      }
    }
  }

  bindEvents() {
    // Check if elements exist before binding events
    if (!this.elements.dropArea || !this.elements.fileInput || !this.elements.browseBtn) {
      console.error('Cannot bind events: Critical elements are missing');
      return;
    }

    console.log('Binding events...');

    // File input events
    this.elements.dropArea.addEventListener('click', (e) => {
      // Only trigger if not clicking on the browse button directly
      if (e.target !== this.elements.browseBtn) {
        console.log('Drop area clicked');
        this.elements.fileInput.click();
      }
    });
    
    this.elements.browseBtn.addEventListener('click', (e) => {
      console.log('Browse button clicked');
      e.preventDefault();
      e.stopPropagation();
      this.elements.fileInput.click();
    });
    
    this.elements.fileInput.addEventListener('change', (e) => {
      console.log('File input changed:', e.target.files.length, 'files selected');
      this.handleFiles(e.target.files);
    });

    // Drag and drop events
    this.elements.dropArea.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    this.elements.dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.elements.dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.elements.dropArea.addEventListener('drop', (e) => this.handleDrop(e));

    // Keyboard support
    this.elements.dropArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.elements.fileInput.click();
      }
    });

    // Action buttons - only bind if they exist
    if (this.elements.processBtn) {
      this.elements.processBtn.addEventListener('click', () => this.processFiles());
    }
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => this.clearAll());
    }

    // Page range validation - only bind if element exists
    if (this.elements.pageRanges) {
      this.elements.pageRanges.addEventListener('input', () => this.validatePageRanges());
    }

    console.log('Events bound successfully');
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.dragCounter++;
    this.elements.dropArea.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.elements.dropArea.classList.remove('drag-over');
    }
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDrop(e) {
    e.preventDefault();
    this.dragCounter = 0;
    this.elements.dropArea.classList.remove('drag-over');
    this.handleFiles(e.dataTransfer.files);
  }

  async handleFiles(fileList) {
    const validFiles = [];
    
    for (const file of fileList) {
      if (!this.validateFile(file)) continue;
      
      try {
        const fileInfo = await this.analyzeFile(file);
        validFiles.push(fileInfo);
      } catch (error) {
        this.showStatus(`Error analyzing ${file.name}: ${error.message}`, 'error');
      }
    }

    this.files.push(...validFiles);
    this.updateUI();
    this.elements.fileInput.value = '';
  }

  validateFile(file) {
    console.log(`Validating file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    
    // Check file extension as backup if MIME type is incorrect
    const isPdfByExtension = file.name.toLowerCase().endsWith('.pdf');
    const isPdfByMimeType = file.type === 'application/pdf';
    
    if (!isPdfByMimeType && !isPdfByExtension) {
      this.showStatus(`${file.name} is not a PDF file`, 'error');
      return false;
    }
    
    if (!isPdfByMimeType && isPdfByExtension) {
      console.warn(`File ${file.name} has PDF extension but MIME type is ${file.type}`);
    }

    if (file.size > this.maxFileSize) {
      this.showStatus(`${file.name} exceeds the 50MB limit`, 'error');
      return false;
    }
    
    if (file.size === 0) {
      this.showStatus(`${file.name} appears to be empty`, 'error');
      return false;
    }

    if (this.files.some(f => f.file.name === file.name && f.file.size === file.size)) {
      this.showStatus(`${file.name} is already added`, 'error');
      return false;
    }

    console.log(`File ${file.name} passed validation`);
    return true;
  }

  async analyzeFile(file) {
    try {
      console.log(`Analyzing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
      
      // Check if file is actually a PDF
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
      }
      
      // Check file size (prevent extremely large files)
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('PDF file is too large (max 50MB)');
      }
      
      if (file.size === 0) {
        throw new Error('PDF file is empty');
      }
      
      const arrayBuffer = await file.arrayBuffer();
      console.log(`ArrayBuffer loaded: ${arrayBuffer.byteLength} bytes`);
      
      // Check if it starts with PDF header
      const uint8Array = new Uint8Array(arrayBuffer.slice(0, 8));
      const header = String.fromCharCode(...uint8Array);
      console.log(`PDF header: ${header}`);
      
      if (!header.startsWith('%PDF-')) {
        throw new Error('File does not appear to be a valid PDF (missing PDF header)');
      }
      
      // Import pdf-lib dynamically with fallback
      console.log('Loading pdf-lib library...');
      let pdfLib;
      try {
        pdfLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.js');
      } catch (importError) {
        console.warn('Failed to load from unpkg, trying alternative CDN...', importError);
        try {
          pdfLib = await import('https://cdn.skypack.dev/pdf-lib@1.17.1');
        } catch (fallbackError) {
          console.error('Failed to load pdf-lib from any CDN', fallbackError);
          throw new Error('Failed to load PDF processing library. Please check your internet connection and try again.');
        }
      }
      console.log('pdf-lib loaded successfully');
      
      console.log('Attempting to load PDF document...');
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer, {
        ignoreEncryption: false,
        parseSpeed: pdfLib.ParseSpeeds.Fastest
      });
      console.log('PDF document loaded successfully');
      
      const pageCount = pdfDoc.getPageCount();
      const title = pdfDoc.getTitle() || file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
      
      console.log(`PDF analysis complete: ${pageCount} pages, title: ${title}`);
      
      return {
        id: this.generateId(),
        file: file,
        pdfDoc: pdfDoc,
        pageCount: pageCount,
        title: title,
        size: file.size,
        isEncrypted: false // pdf-lib will throw if encrypted
      };
    } catch (error) {
      console.error(`Error analyzing PDF "${file.name}":`, error);
      
      if (error.message.includes('encrypted') || error.message.includes('password')) {
        throw new Error('This PDF is password protected and cannot be processed');
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Failed to load PDF processing library. Please check your internet connection.');
      }
      
      if (error.message.includes('PDF header')) {
        throw new Error('File is not a valid PDF document');
      }
      
      if (error.message.includes('too large')) {
        throw new Error(error.message);
      }
      
      if (error.message.includes('empty')) {
        throw new Error('PDF file appears to be empty');
      }
      
      // More specific error for common PDF issues
      if (error.message.includes('EOF') || error.message.includes('truncated')) {
        throw new Error('PDF file appears to be incomplete or corrupted');
      }
      
      throw new Error(`Cannot process this PDF: ${error.message}`);
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  updateUI() {
    this.updateFileList();
    this.updateStats();
    this.updateButtons();
  }

  updateFileList() {
    this.elements.fileList.innerHTML = '';
    
    this.files.forEach((fileInfo, index) => {
      const fileElement = this.createFileElement(fileInfo, index);
      this.elements.fileList.appendChild(fileElement);
    });

    // Make file list sortable
    this.makeSortable();
  }

  createFileElement(fileInfo, index) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.draggable = true;
    div.dataset.index = index;
    div.dataset.fileId = fileInfo.id;

    div.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
      <div class="file-info">
        <div class="file-name">${fileInfo.file.name}</div>
        <div class="file-meta">
          <span>${this.formatBytes(fileInfo.size)}</span>
          <span>${fileInfo.pageCount} pages</span>
          <span>Added ${new Date().toLocaleTimeString()}</span>
        </div>
      </div>
      <div class="file-controls">
        <button type="button" onclick="pdfProcessor.moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" onclick="pdfProcessor.moveFile(${index}, 1)" ${index === this.files.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" onclick="pdfProcessor.removeFile(${index})">Remove</button>
      </div>
    `;

    // Add drag events
    div.addEventListener('dragstart', (e) => this.handleDragStart(e));
    div.addEventListener('dragend', (e) => this.handleDragEnd(e));

    return div;
  }

  makeSortable() {
    const fileItems = this.elements.fileList.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
      item.addEventListener('dragover', (e) => this.handleSortDragOver(e));
      item.addEventListener('drop', (e) => this.handleSortDrop(e));
    });
  }

  handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
    e.target.classList.add('dragging');
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
  }

  handleSortDragOver(e) {
    e.preventDefault();
  }

  handleSortDrop(e) {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetIndex = parseInt(e.currentTarget.dataset.index);
    
    if (draggedIndex !== targetIndex) {
      this.reorderFiles(draggedIndex, targetIndex);
    }
  }

  reorderFiles(fromIndex, toIndex) {
    const [movedFile] = this.files.splice(fromIndex, 1);
    this.files.splice(toIndex, 0, movedFile);
    this.updateUI();
  }

  moveFile(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < this.files.length) {
      this.reorderFiles(index, newIndex);
    }
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.updateUI();
  }

  updateStats() {
    const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
    this.elements.fileCount.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    this.elements.totalSize.textContent = this.formatBytes(totalSize);
  }

  updateButtons() {
    const hasFiles = this.files.length > 0;
    this.elements.processBtn.disabled = !hasFiles || this.isProcessing;
    this.elements.clearBtn.style.display = hasFiles ? 'block' : 'none';
  }

  validatePageRanges() {
    const ranges = this.elements.pageRanges.value.trim();
    if (!ranges) return true;

    const rangePattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
    if (!rangePattern.test(ranges)) {
      this.elements.pageRanges.setCustomValidity('Invalid format. Use: 1-3,5,7-8');
      return false;
    }

    this.elements.pageRanges.setCustomValidity('');
    return true;
  }

  parsePageRanges(rangeString, maxPages) {
    if (!rangeString.trim()) return Array.from({length: maxPages}, (_, i) => i);

    const pages = new Set();
    const ranges = rangeString.split(',').map(r => r.trim());

    for (const range of ranges) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n) - 1);
        if (start < 0 || end >= maxPages || start > end) {
          throw new Error(`Invalid range: ${range} (max pages: ${maxPages})`);
        }
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      } else {
        const page = parseInt(range) - 1;
        if (page < 0 || page >= maxPages) {
          throw new Error(`Page ${range} out of range (max pages: ${maxPages})`);
        }
        pages.add(page);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  async processFiles() {
    if (this.isProcessing || this.files.length === 0) return;

    this.isProcessing = true;
    this.elements.processBtn.disabled = true;
    this.elements.progressSection.style.display = 'block';
    this.elements.resultSection.style.display = 'none';

    try {
      await this.performProcessing();
    } catch (error) {
      console.error('Processing error:', error);
      this.showStatus(`Processing failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
      this.elements.processBtn.disabled = false;
    }
  }

  async performProcessing() {
    const pdfLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.js');
    const mergedPdf = await pdfLib.PDFDocument.create();

    this.updateProgress(0, 'Preparing merge...');
    
    const totalFiles = this.files.length;
    const rangeString = this.elements.pageRanges.value.trim();

    for (let i = 0; i < totalFiles; i++) {
      const fileInfo = this.files[i];
      const progress = ((i + 1) / totalFiles) * 80; // Reserve 20% for final steps
      
      this.updateProgress(progress, `Processing ${fileInfo.file.name}...`);
      this.updateProgressDetails(`Extracting pages from file ${i + 1} of ${totalFiles}`);

      try {
        let pageIndices;
        if (rangeString) {
          pageIndices = this.parsePageRanges(rangeString, fileInfo.pageCount);
        } else {
          pageIndices = Array.from({length: fileInfo.pageCount}, (_, i) => i);
        }

        if (pageIndices.length > 0) {
          const copiedPages = await mergedPdf.copyPages(fileInfo.pdfDoc, pageIndices);
          copiedPages.forEach(page => mergedPdf.addPage(page));
        }
      } catch (error) {
        throw new Error(`Error processing ${fileInfo.file.name}: ${error.message}`);
      }
    }

    this.updateProgress(85, 'Finalizing PDF...');
    this.updateProgressDetails('Generating final PDF document');

    const pdfBytes = await mergedPdf.save();
    let finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    // Check compression setting
    const compressionLevel = document.querySelector('input[name="compression"]:checked').value;
    
    if (compressionLevel !== 'none') {
      this.updateProgress(90, 'Applying compression...');
      this.updateProgressDetails('Optimizing file size');
      
      try {
        finalBlob = await this.compressPDF(finalBlob, compressionLevel);
      } catch (error) {
        console.warn('Compression failed, using uncompressed version:', error);
        this.showStatus('Compression failed, using original file', 'info');
      }
    }

    this.updateProgress(100, 'Complete!');
    this.updateProgressDetails('PDF processing completed successfully');

    // Show result
    this.showResult(finalBlob);
  }

  async compressPDF(pdfBlob, level) {
    const formData = new FormData();
    formData.append('pdf', pdfBlob, 'input.pdf');
    formData.append('level', level);

    try {
      const response = await fetch('http://localhost:3001/api/compress-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const compressedBlob = await response.blob();
      
      // Get compression stats from headers
      const originalSize = parseInt(response.headers.get('X-Original-Size') || '0');
      const compressedSize = parseInt(response.headers.get('X-Compressed-Size') || compressedBlob.size);
      const compressionRatio = response.headers.get('X-Compression-Ratio');
      
      if (compressionRatio) {
        this.showStatus(`Compression completed: ${compressionRatio}% size reduction`, 'success');
      }
      
      return compressedBlob;
    } catch (error) {
      // If server is not available, fall back to client-side processing
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        this.showStatus('Compression server unavailable, using original file', 'info');
        return pdfBlob;
      }
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  showResult(blob) {
    const originalSize = this.files.reduce((sum, file) => sum + file.size, 0);
    const finalSize = blob.size;
    const savings = originalSize > finalSize ? 
      `${Math.round((1 - finalSize / originalSize) * 100)}% smaller` : 
      'No size reduction';

    this.elements.resultDetails.textContent = 
      `${this.formatBytes(finalSize)} • ${savings}`;
    
    this.elements.downloadBtn.onclick = () => this.downloadBlob(blob, 'merged-document.pdf');
    this.elements.resultSection.style.display = 'flex';
    
    this.showStatus('PDF processing completed successfully!', 'success');
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  updateProgress(percent, text) {
    this.elements.progressFill.style.width = `${percent}%`;
    this.elements.progressPercent.textContent = `${Math.round(percent)}%`;
    this.elements.progressText.textContent = text;
  }

  updateProgressDetails(text) {
    this.elements.progressDetails.textContent = text;
  }

  clearAll() {
    this.files = [];
    this.elements.pageRanges.value = '';
    this.elements.progressSection.style.display = 'none';
    this.elements.resultSection.style.display = 'none';
    this.updateUI();
    this.showStatus('All files cleared', 'info');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    
    // Try to find status element if not already found
    if (!this.elements.status) {
      this.elements.status = document.getElementById('status');
    }
    
    // If still no status element, create a temporary one or use console
    if (!this.elements.status) {
      console.warn('Status element not found, using console output');
      return;
    }

    const statusEl = document.createElement('div');
    statusEl.className = `status-message ${type}`;
    statusEl.textContent = message;
    
    this.elements.status.appendChild(statusEl);
    
    // Trigger animation
    setTimeout(() => statusEl.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      statusEl.classList.remove('show');
      setTimeout(() => {
        if (statusEl.parentNode) {
          statusEl.parentNode.removeChild(statusEl);
        }
      }, 300);
    }, 5000);
  }
}

// Initialize the PDF processor when the page loads
let pdfProcessor;

// Global test function for debugging
window.testFileInput = function() {
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const dropArea = document.getElementById('drop-area');
  
  console.log('Testing file input elements:');
  console.log('fileInput:', fileInput);
  console.log('browseBtn:', browseBtn);
  console.log('dropArea:', dropArea);
  
  if (fileInput) {
    fileInput.click();
  } else {
    console.error('File input not found!');
  }
};

// Global test function for manual file handling
window.testBrowse = function() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.click();
    console.log('File input clicked manually');
  } else {
    console.error('File input element not found');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing PDF Processor');
  try {
    pdfProcessor = new PDFProcessor();
    console.log('PDF Processor initialized successfully');
    
    // Make it globally accessible for debugging
    window.pdfProcessor = pdfProcessor;
  } catch (error) {
    console.error('Failed to initialize PDF Processor:', error);
    
    // Fallback: Simple file input handling
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const dropArea = document.getElementById('drop-area');
    
    if (fileInput && browseBtn && dropArea) {
      console.log('Setting up fallback file handling');
      
      // Browse button click
      browseBtn.addEventListener('click', (e) => {
        console.log('Fallback: Browse button clicked');
        e.stopPropagation();
        e.preventDefault();
        fileInput.click();
      });
      
      // Drop area click
      dropArea.addEventListener('click', (e) => {
        if (e.target !== browseBtn) {
          console.log('Fallback: Drop area clicked');
          fileInput.click();
        }
      });
      
      // File input change
      fileInput.addEventListener('change', (e) => {
        console.log('Files selected (fallback):', e.target.files.length);
        const fileNames = Array.from(e.target.files).map(f => f.name).join(', ');
        alert(`Selected ${e.target.files.length} file(s): ${fileNames}`);
      });
      
      // Basic drag and drop
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
      
      dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        console.log('Files dropped (fallback):', files.length);
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        alert(`Dropped ${files.length} file(s): ${fileNames}`);
      });
      
      console.log('Fallback file handling set up successfully');
    } else {
      console.error('Even fallback elements not found');
    }
  }
});
