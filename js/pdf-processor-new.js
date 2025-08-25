/**
 * Enhanced PDF Processor with Page Preview and Drag-Drop Functionality
 * Features: File upload, page preview modal, drag-and-drop reordering, compression options
 * Version: 3.0.0
 */

class EnhancedPDFProcessor {
  constructor() {
    this.files = new Map();
    this.pages = []; // Array of page objects for the modal
    this.isProcessing = false;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.dragCounter = 0;
    this.mergedPdfData = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 Initializing Enhanced PDF Processor v3.0.0');
      
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      this.initializeElements();
      this.bindEvents();
      this.updateUI();
      this.showReadyState();
      
      console.log('✅ Enhanced PDF Processor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PDF Processor:', error);
      this.showError('Failed to initialize PDF processor. Please refresh the page.');
    }
  }

  initializeElements() {
    this.elements = {
      // Upload section
      dropArea: document.getElementById('drop-area'),
      fileInput: document.getElementById('file-input'),
      browseBtn: document.getElementById('browse-btn'),
      fileTags: document.getElementById('file-tags'),
      fileInfo: document.getElementById('file-info'),
      mergeFilesBtn: document.getElementById('merge-files-btn'),
      
      // Modal elements
      pagePreviewModal: document.getElementById('page-preview-modal'),
      closeModal: document.getElementById('close-modal'),
      pagesContainer: document.getElementById('pages-container'),
      completeMergeBtn: document.getElementById('complete-merge-btn'),
      
      // Loading overlay
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingMessage: document.getElementById('loading-message'),
      
      // Download section
      downloadSection: document.getElementById('download-section'),
      downloadBtn: document.getElementById('download-btn'),
      compressionRadios: document.querySelectorAll('input[name="download-compression"]'),
      
      // Toast container
      toastContainer: document.getElementById('toast-container')
    };

    // Validate critical elements
    const criticalElements = ['dropArea', 'fileInput', 'browseBtn', 'fileTags', 'mergeFilesBtn'];
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

    // Merge files button
    this.elements.mergeFilesBtn.addEventListener('click', () => this.openPagePreviewModal());

    // Modal events
    if (this.elements.closeModal) {
      this.elements.closeModal.addEventListener('click', () => this.closePagePreviewModal());
    }

    if (this.elements.completeMergeBtn) {
      this.elements.completeMergeBtn.addEventListener('click', () => this.completeMerge());
    }

    // Download button
    if (this.elements.downloadBtn) {
      this.elements.downloadBtn.addEventListener('click', () => this.downloadMergedFile());
    }

    // Close modal on outside click
    if (this.elements.pagePreviewModal) {
      this.elements.pagePreviewModal.addEventListener('click', (e) => {
        if (e.target === this.elements.pagePreviewModal) {
          this.closePagePreviewModal();
        }
      });
    }

    // Keyboard accessibility
    this.elements.dropArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.triggerFileSelect(e);
      }
    });

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
    
    const results = await Promise.allSettled(
      files.map(file => this.addFile(file))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (successful > 0) {
      const message = `Added ${successful} file(s) successfully${failed > 0 ? ` (${failed} failed)` : ''}`;
      this.showToast(message, 'success');
    } else if (failed > 0) {
      this.showToast(`Failed to add ${failed} file(s)`, 'error');
    }
    
    this.updateUI();
  }

  async addFile(file) {
    try {
      const fileId = this.generateUniqueId(file);
      
      if (this.files.has(fileId)) {
        throw new Error(`File "${file.name}" is already in the list`);
      }
      
      this.validateFile(file);
      const pdfInfo = await this.analyzePDF(file);
      
      const fileRecord = {
        id: fileId,
        file: file,
        name: file.name,
        size: file.size,
        pageCount: pdfInfo.pageCount,
        title: pdfInfo.title,
        pdfDoc: pdfInfo.pdfDoc,
        isEncrypted: pdfInfo.isEncrypted,
        addedAt: new Date()
      };
      
      this.files.set(fileId, fileRecord);
      console.log(`✅ Added file: ${file.name} (${pdfInfo.pageCount} pages)`);
      return fileRecord;
      
    } catch (error) {
      console.error(`❌ Failed to add file "${file.name}":`, error);
      throw error;
    }
  }

  generateUniqueId(file) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const fileHash = `${file.name}-${file.size}-${file.lastModified || timestamp}`;
    return `${fileHash}-${random}`;
  }

  validateFile(file) {
    console.log(`🔍 Validating file: ${file.name}`);
    
    const isPdfByMime = file.type === 'application/pdf';
    const isPdfByExtension = file.name.toLowerCase().endsWith('.pdf');
    
    if (!isPdfByMime && !isPdfByExtension) {
      throw new Error('Only PDF files are supported');
    }
    
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
      const arrayBuffer = await file.arrayBuffer();
      
      // Validate PDF header
      const header = new Uint8Array(arrayBuffer.slice(0, 8));
      const headerString = String.fromCharCode(...header);
      
      if (!headerString.startsWith('%PDF-')) {
        throw new Error('Invalid PDF file format');
      }
      
      const pdfLib = await this.loadPDFLib();
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
      window.pdfLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.js');
      console.log('✅ PDF-lib loaded from unpkg');
      return window.pdfLib;
    } catch (error) {
      console.warn('⚠️ Primary CDN failed, trying fallback...');
      
      try {
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
    this.updateFileTags();
    this.updateStats();
    this.updateMergeButton();
  }

  updateFileTags() {
    const container = this.elements.fileTags;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.files.size === 0) {
      return;
    }
    
    Array.from(this.files.values()).forEach((fileRecord, index) => {
      const fileTag = this.createFileTag(fileRecord, index + 1);
      container.appendChild(fileTag);
    });
  }

  createFileTag(fileRecord, number) {
    const tag = document.createElement('div');
    tag.className = 'file-tag';
    tag.dataset.fileId = fileRecord.id;
    
    const displayName = fileRecord.name.length > 15 
      ? fileRecord.name.substring(0, 12) + '...' 
      : fileRecord.name;
    
    tag.innerHTML = `
      <span class="file-tag-number">${number}</span>
      <span class="file-tag-name" title="${fileRecord.name}">${displayName}</span>
      <button class="file-tag-remove" onclick="enhancedPdfProcessor.removeFile('${fileRecord.id}')" title="Remove ${fileRecord.name}">
        ×
      </button>
    `;
    
    return tag;
  }

  updateStats() {
    const statsElement = this.elements.fileInfo;
    if (!statsElement) return;
    
    const fileCount = this.files.size;
    const totalPages = Array.from(this.files.values()).reduce((sum, f) => sum + f.pageCount, 0);
    const totalSize = Array.from(this.files.values()).reduce((sum, f) => sum + f.size, 0);
    
    if (fileCount === 0) {
      statsElement.textContent = 'No files selected';
      statsElement.className = 'file-info';
    } else {
      statsElement.textContent = `${fileCount} file(s) • ${totalPages} pages total • ${this.formatFileSize(totalSize)}`;
      statsElement.className = 'file-info has-files';
    }
  }

  updateMergeButton() {
    const hasFiles = this.files.size > 0;
    this.elements.mergeFilesBtn.disabled = !hasFiles || this.isProcessing;
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

  // Page Preview Modal Methods
  async openPagePreviewModal() {
    if (this.files.size === 0) {
      this.showStatus('No files to merge', 'error');
      return;
    }

    console.log('📖 Opening page preview modal');
    
    try {
      this.showStatus('Preparing page previews...', 'info');
      await this.generatePagePreviews();
      this.renderPagePreviews();
      this.elements.pagePreviewModal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent body scroll
    } catch (error) {
      console.error('Failed to open page preview modal:', error);
      this.showStatus('Failed to load page previews', 'error');
    }
  }

  closePagePreviewModal() {
    this.elements.pagePreviewModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore body scroll
  }

  async generatePagePreviews() {
    this.pages = [];
    let globalPageNumber = 1;

    for (const fileRecord of this.files.values()) {
      for (let pageIndex = 0; pageIndex < fileRecord.pageCount; pageIndex++) {
        const pageObj = {
          id: `${fileRecord.id}-page-${pageIndex}`,
          fileId: fileRecord.id,
          fileName: fileRecord.name,
          pageNumber: pageIndex + 1,
          globalPageNumber: globalPageNumber++,
          filePageIndex: pageIndex,
          pdfDoc: fileRecord.pdfDoc
        };
        
        this.pages.push(pageObj);
      }
    }

    console.log(`Generated ${this.pages.length} page previews`);
  }

  renderPagePreviews() {
    const container = this.elements.pagesContainer;
    if (!container) return;

    container.innerHTML = '';

    this.pages.forEach((page, index) => {
      const pageCard = this.createPageCard(page, index);
      container.appendChild(pageCard);
    });

    this.bindPageCardEvents();
  }

  createPageCard(page, index) {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.draggable = true;
    card.dataset.pageId = page.id;
    card.dataset.index = index;

    card.innerHTML = `
      <button class="page-remove" onclick="enhancedPdfProcessor.removePage(${index})" title="Remove this page">×</button>
      <div class="page-preview">📄</div>
      <div class="page-number">Page ${page.globalPageNumber}</div>
      <div class="page-file">${page.fileName}</div>
    `;

    return card;
  }

  bindPageCardEvents() {
    const pageCards = this.elements.pagesContainer.querySelectorAll('.page-card');
    
    pageCards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', e.target.dataset.index);
        e.target.classList.add('dragging');
      });

      card.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const targetIndex = parseInt(e.target.closest('.page-card').dataset.index);
        
        if (draggedIndex !== targetIndex) {
          this.reorderPages(draggedIndex, targetIndex);
          this.renderPagePreviews(); // Re-render to update positions
        }
      });
    });
  }

  reorderPages(fromIndex, toIndex) {
    const movedPage = this.pages.splice(fromIndex, 1)[0];
    this.pages.splice(toIndex, 0, movedPage);
    
    // Update global page numbers
    this.pages.forEach((page, index) => {
      page.globalPageNumber = index + 1;
    });
    
    console.log(`Moved page from position ${fromIndex} to ${toIndex}`);
  }

  removePage(index) {
    if (index >= 0 && index < this.pages.length) {
      const removedPage = this.pages.splice(index, 1)[0];
      console.log(`Removed page ${removedPage.globalPageNumber} from ${removedPage.fileName}`);
      
      // Update global page numbers
      this.pages.forEach((page, idx) => {
        page.globalPageNumber = idx + 1;
      });
      
      this.renderPagePreviews();
      
      if (this.pages.length === 0) {
        this.showStatus('No pages remaining to merge', 'error');
      }
    }
  }

  // Merge Process
  async completeMerge() {
    if (this.pages.length === 0) {
      this.showStatus('No pages to merge', 'error');
      return;
    }

    console.log(`🔄 Starting merge process with ${this.pages.length} pages`);
    
    this.closePagePreviewModal();
    this.showLoading('Merging PDF pages...');

    try {
      const pdfLib = await this.loadPDFLib();
      const mergedPdf = await pdfLib.PDFDocument.create();

      // Add pages in the order they appear in the modal
      for (const page of this.pages) {
        const [copiedPage] = await mergedPdf.copyPages(page.pdfDoc, [page.filePageIndex]);
        mergedPdf.addPage(copiedPage);
      }

      this.updateLoadingMessage('Finalizing document...');
      this.mergedPdfData = await mergedPdf.save();
      
      this.hideLoading();
      this.showDownloadSection();
      this.showStatus('✅ Merge completed successfully!', 'success');
      
      console.log('✅ PDF merge completed successfully');

    } catch (error) {
      console.error('❌ Merge failed:', error);
      this.hideLoading();
      this.showStatus(`Merge failed: ${error.message}`, 'error');
    }
  }

  // Download Methods
  showDownloadSection() {
    if (this.elements.downloadSection) {
      this.elements.downloadSection.style.display = 'block';
      this.elements.downloadSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async downloadMergedFile() {
    if (!this.mergedPdfData) {
      this.showStatus('No merged file available for download', 'error');
      return;
    }

    try {
      const selectedCompression = document.querySelector('input[name="download-compression"]:checked').value;
      console.log(`📥 Downloading with ${selectedCompression} compression`);

      let finalPdfData = this.mergedPdfData;

      // Apply compression if needed
      if (selectedCompression !== 'none') {
        this.showLoading('Applying compression...');
        try {
          finalPdfData = await this.applyCompression(this.mergedPdfData, selectedCompression);
        } catch (compressionError) {
          console.warn('Compression failed, using original PDF:', compressionError);
          this.showStatus('Compression failed, downloading original quality', 'warning');
        }
        this.hideLoading();
      }

      // Create download
      const blob = new Blob([finalPdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `merged-pdf-${timestamp}.pdf`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      this.showStatus(`Downloaded: ${filename}`, 'success');
      console.log(`📥 Download completed: ${filename}`);

    } catch (error) {
      console.error('Download failed:', error);
      this.showStatus(`Download failed: ${error.message}`, 'error');
    }
  }

  async applyCompression(pdfData, level) {
    // This would typically call a server-side compression service
    // For now, we'll just return the original data
    console.log(`🗜️ Applying ${level} compression (simulated)`);
    
    // Simulate compression delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return pdfData;
  }

  // Loading Methods
  showLoading(message) {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    if (this.elements.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
  }

  updateLoadingMessage(message) {
    if (this.elements.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
  }

  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // Status Methods
  showStatus(message, type = 'info') {
    // Status messages now handled by toast notifications
    console.log(`Status: ${message}`);
  }

  showReadyState() {
    // Ready state - no message needed
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

  // Toast Notification Methods
  showToast(message, type = 'success', duration = 5000) {
    if (!this.elements.toastContainer) {
      console.warn('Toast container not found');
      return;
    }

    const toast = this.createToastElement(message, type);
    this.elements.toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove after duration
    const autoRemoveTimer = setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    // Store timer for potential early removal
    toast._autoRemoveTimer = autoRemoveTimer;

    return toast;
  }

  createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = this.getToastIcon(type);
    
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${icon}
      </svg>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close notification">×</button>
    `;

    // Add close button event
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast);
    });

    return toast;
  }

  getToastIcon(type) {
    const icons = {
      success: '<path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>',
      error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
      warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>',
      info: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
    };
    return icons[type] || icons.info;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    // Clear auto-remove timer if it exists
    if (toast._autoRemoveTimer) {
      clearTimeout(toast._autoRemoveTimer);
    }

    // Animate out
    toast.classList.remove('show');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

// Global instance and initialization
let enhancedPdfProcessor;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEnhancedPDFProcessor);
} else {
  initializeEnhancedPDFProcessor();
}

async function initializeEnhancedPDFProcessor() {
  try {
    enhancedPdfProcessor = new EnhancedPDFProcessor();
    window.enhancedPdfProcessor = enhancedPdfProcessor; // Make globally accessible
  } catch (error) {
    console.error('Failed to initialize Enhanced PDF Processor:', error);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedPDFProcessor;
}
