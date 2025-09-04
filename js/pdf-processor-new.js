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
  // Zoom/render state
  this._pdfjsRenderTask = null;
  this._renderInProgress = false;
  this._queuedScale = null;
  this._zoomDebounceTimer = null;
    // Page numbering settings (disabled by default)
    this.pageNumberSettings = {
      enabled: false,
      mode: 'auto', // 'auto' | 'manual'
      startNumber: 1,
      font: 'Helvetica',
      fontSize: 12,
      color: '#000000',
      position: { normX: 0.5, normY: 0.95 }, // normalized from top-left (0..1)
      applyToAll: true,
      startIndex: 0
    };
    
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
    
    // Debug: Check if complete merge button exists
    console.log('Complete Merge Button:', this.elements.completeMergeBtn);
    if (this.elements.completeMergeBtn) {
      console.log('✅ Complete Merge Button found');
    } else {
      console.warn('⚠️ Complete Merge Button not found!');
    }
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
      console.log('🔗 Setting up Complete Merge button event listener');
      this.elements.completeMergeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('🚀 Complete Merge button clicked');
        await this.completeMerge();
      });
    } else {
      console.error('❌ Cannot set up Complete Merge button - element not found');
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
        pdfJSDoc: pdfInfo.pdfJSDoc,
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

      // Load with pdf-lib for manipulation
      const pdfLib = await this.loadPDFLib();
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer, {
        ignoreEncryption: false
      });
      
      const pageCount = pdfDoc.getPageCount();
      const title = pdfDoc.getTitle() || file.name.replace(/\.[^/.]+$/, '');
      
      // Try to load with PDF.js for rendering (optional)
      let pdfJSDoc = null;
      try {
        const pdfjsLib = await this.loadPDFJS();
        pdfJSDoc = await pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true
        }).promise;
        console.log('✅ PDF.js document loaded for rendering');
      } catch (pdfJSError) {
        console.warn('⚠️ PDF.js loading failed, page previews will use placeholders:', pdfJSError.message);
      }
      
      console.log(`✅ PDF analysis complete: ${pageCount} pages`);
      
      return {
        pdfDoc,        // pdf-lib document for manipulation
        pdfJSDoc,      // PDF.js document for rendering (may be null)
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

  async loadPDFJS() {
    // Wait for PDF.js to be fully loaded with retries
    let retries = 0;
    const maxRetries = 20; // 2 seconds total
    
    while (retries < maxRetries) {
      if (window.pdfjsLib && window.pdfjsLib.getDocument) {
        console.log('✅ PDF.js fully loaded and ready');
        return window.pdfjsLib;
      }
      
      console.log(`⏳ Waiting for PDF.js... attempt ${retries + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    console.error('⚠️ PDF.js not found after waiting');
    console.log('Available on window:', Object.keys(window).filter(key => key.toLowerCase().includes('pdf')));
    throw new Error('PDF.js library not loaded. Page previews will not be available.');
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
      this.generateFileLabels();
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

    console.log('Starting simple page preview generation...');

    for (const fileRecord of this.files.values()) {
      console.log(`Processing ${fileRecord.name}...`);
      
      for (let pageIndex = 0; pageIndex < fileRecord.pageCount; pageIndex++) {
        const pageObj = {
          id: `${fileRecord.id}-page-${pageIndex}`,
          fileId: fileRecord.id,
          fileName: fileRecord.name,
          pageNumber: pageIndex + 1,
          globalPageNumber: globalPageNumber++,
          filePageIndex: pageIndex,
          pdfDoc: fileRecord.pdfDoc,
          pdfJSDoc: fileRecord.pdfJSDoc
        };
        
        this.pages.push(pageObj);
      }
    }

    console.log(`Generated ${this.pages.length} pages`);
  }

  generateFileLabels() {
    const fileLabelsContainer = document.querySelector('.file-labels');
    if (!fileLabelsContainer) return;

    fileLabelsContainer.innerHTML = '';

    // Create a map to assign colors to files
    const uniqueFiles = new Map();
    let colorIndex = 0;

    // First pass: collect unique files and assign colors
    for (const fileRecord of this.files.values()) {
      if (!uniqueFiles.has(fileRecord.id)) {
        uniqueFiles.set(fileRecord.id, {
          name: fileRecord.name,
          colorIndex: colorIndex % 8 // We have 8 color variants
        });
        colorIndex++;
      }
    }

    // Store file colors for use in page cards
    this.fileColors = uniqueFiles;

    // Create file labels
    for (const [fileId, fileInfo] of uniqueFiles) {
      const label = document.createElement('div');
      label.className = `file-label file-color-${fileInfo.colorIndex}`;
      label.innerHTML = `
        <div class="file-color-dot"></div>
        <span class="file-name">${fileInfo.name}</span>
      `;
      fileLabelsContainer.appendChild(label);
    }
  }

  renderPagePreviews() {
    const container = this.elements.pagesContainer;
    if (!container) return;

    container.innerHTML = '';

    // Add initial plus button
    const initialPlus = this.createInsertZone(0);
    container.appendChild(initialPlus);

    this.pages.forEach((page, index) => {
      const pageCard = this.createPageCard(page, index);
      container.appendChild(pageCard);
      
      // Add plus button after each page (except the last one)
      if (index < this.pages.length - 1) {
        const plusButton = this.createInsertZone(index + 1);
        container.appendChild(plusButton);
      }
    });

    // Add final plus button
    const finalPlus = this.createInsertZone(this.pages.length);
    container.appendChild(finalPlus);

    this.bindPageCardEvents();
  }

  createInsertZone(insertIndex) {
    const zone = document.createElement('div');
    zone.className = 'page-insert-zone';
    zone.dataset.insertIndex = insertIndex;

    const plus = document.createElement('div');
    plus.className = 'page-insert-plus';
    plus.innerHTML = '+';

    zone.appendChild(plus);

    // Add drag and drop event listeners
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const targetIndex = parseInt(zone.dataset.insertIndex);
      
      this.movePageToPosition(draggedIndex, targetIndex);
    });

    return zone;
  }

  createPageCard(page, index) {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.draggable = true;
    card.dataset.pageId = page.id;
    card.dataset.index = index;

    // Apply color coding
    if (this.fileColors && this.fileColors.has(page.fileId)) {
      const colorIndex = this.fileColors.get(page.fileId).colorIndex;
      card.classList.add(`file-color-${colorIndex}`);
    }

    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.className = 'page-remove';
    removeButton.innerHTML = '×';
    removeButton.onclick = () => enhancedPdfProcessor.removePage(index);

    // Create preview container
    const previewDiv = document.createElement('div');
    previewDiv.className = 'page-preview';

    // Create page number
    const pageNumberDiv = document.createElement('div');
    pageNumberDiv.className = 'page-number';
    pageNumberDiv.textContent = page.globalPageNumber;

    // Try to render the PDF page directly
    if (page.pdfJSDoc) {
      this.renderPageToDiv(page.pdfJSDoc, page.filePageIndex, previewDiv);
    } else {
      previewDiv.innerHTML = '<div class="page-placeholder">📄</div>';
    }

    // Add double-click functionality for fullscreen preview
    previewDiv.addEventListener('dblclick', (e) => {
      this.showFullscreenPreview(page);
    });

    card.appendChild(removeButton);
    card.appendChild(previewDiv);
    card.appendChild(pageNumberDiv);

    return card;
  }

  async renderPageToDiv(pdfJSDoc, pageIndex, container) {
    try {
      console.log(`Attempting to render page ${pageIndex + 1} from PDF with ${pdfJSDoc.numPages} pages`);
      
      // Validate page index
      if (pageIndex < 0 || pageIndex >= pdfJSDoc.numPages) {
        throw new Error(`Invalid page index ${pageIndex + 1}. PDF has ${pdfJSDoc.numPages} pages.`);
      }
      
      const page = await pdfJSDoc.getPage(pageIndex + 1);
      const scale = 0.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      container.innerHTML = '';
      container.appendChild(canvas);
      
      console.log(`✅ Rendered page ${pageIndex + 1} successfully`);
    } catch (error) {
      console.error(`❌ Failed to render page ${pageIndex + 1}:`, error);
      console.error('PDF info:', {
        numPages: pdfJSDoc?.numPages,
        requestedIndex: pageIndex + 1
      });
      container.innerHTML = '<div class="page-placeholder">📄<br>Failed to load</div>';
    }
  }

  async showFullscreenPreview(page) {
    try {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'page-fullscreen-overlay';

      // Create content container
      const content = document.createElement('div');
      content.className = 'page-fullscreen-content';
      // Ensure preview always fits viewport while keeping render quality
      Object.assign(content.style, {
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      });

      // Create edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-page-btn';
      editBtn.textContent = 'Edit This Page';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.enterEditMode(page, content, overlay);
      };
      // Default inline style; will be positioned absolutely when inside the frame
      Object.assign(editBtn.style, {
        cursor: 'pointer'
      });

      // Render high-quality version of the page
      if (page.pdfJSDoc) {
        const pdfPage = await page.pdfJSDoc.getPage(page.filePageIndex + 1);
        const scale = 2; // Higher scale for fullscreen
        const viewport = pdfPage.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await pdfPage.render(renderContext).promise;

        // Wrap canvas with a square border frame and make it responsive to fit
        const frame = document.createElement('div');
        frame.className = 'fullscreen-canvas-frame';
        Object.assign(frame.style, {
          border: '2px solid #cbd5e1', // subtle square outline
          borderRadius: '0px',
          background: '#ffffff',
          padding: '8px',
          position: 'relative', // enable absolute positioning of the edit button
          maxWidth: '100%',
          boxSizing: 'border-box'
        });

        Object.assign(canvas.style, {
          display: 'block',
          width: '100%', // fit horizontally within frame/content
          height: 'auto', // preserve aspect ratio
          maxHeight: '80vh', // ensure it fits viewport height
          objectFit: 'contain'
        });

        frame.appendChild(canvas);

        // Position the edit button at the top-right corner of the frame
        Object.assign(editBtn.style, {
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: '10'
        });
        frame.appendChild(editBtn);

        content.appendChild(frame);
      } else {
        content.innerHTML = '<div style="color: #666; font-size: 3rem;">📄</div>';
        // Fallback: no frame exists, place the edit button within content
        content.appendChild(editBtn);
      }
      overlay.appendChild(content);
      document.body.appendChild(overlay);

      // Add event listeners for closing
      const closeFullscreen = () => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.removeEventListener('keydown', handleKeyDown);
        if (overlay) overlay.removeEventListener('click', closeFullscreen);
      };

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeFullscreen();
        }
      };

      // Close on click anywhere on overlay or escape key
      overlay.addEventListener('click', closeFullscreen);
      document.addEventListener('keydown', handleKeyDown);

      // Prevent the overlay from closing when clicking the content
      content.addEventListener('click', (e) => {
        e.stopPropagation();
      });

    } catch (error) {
      console.error('Failed to show fullscreen preview:', error);
    }
  }

  async enterEditMode(page, content, overlay) {
    try {
      console.log('Entering edit mode for page:', page);
      
      // Clear existing content
      content.innerHTML = '';
      content.classList.add('editing-mode');

      // Create editor container
      const editorContainer = document.createElement('div');
      editorContainer.className = 'pdf-editor-container';

      // Add mouse wheel zoom functionality
      editorContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.handleZoom('in');
        } else {
          this.handleZoom('out');
        }
      });

  // Create canvas container first
      const canvasContainer = document.createElement('div');
      canvasContainer.className = 'editor-canvas-container';

  // Render PDF page with higher quality
      const pdfPage = await page.pdfJSDoc.getPage(page.filePageIndex + 1);
      this.currentEditScale = 1.0; // Start with 100% scale
      const viewport = pdfPage.getViewport({ scale: this.currentEditScale });

      console.log('Rendering PDF at scale:', this.currentEditScale, 'viewport:', viewport.width, 'x', viewport.height);

      // PDF layer (background) - this shows the actual PDF content
      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.className = 'pdf-layer';
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      pdfCanvas.style.display = 'block';
      pdfCanvas.style.border = '1px solid #ddd';
      
      const pdfContext = pdfCanvas.getContext('2d');
      await pdfPage.render({
        canvasContext: pdfContext,
        viewport: viewport
      }).promise;

      console.log('PDF rendered successfully');

      // Edit layer (annotations overlay)
      const editCanvas = document.createElement('canvas');
      editCanvas.className = 'edit-layer';
      editCanvas.width = viewport.width;
      editCanvas.height = viewport.height;

      // Interaction layer (click handling)
      const interactionDiv = document.createElement('div');
      interactionDiv.className = 'interaction-layer';
      interactionDiv.style.width = viewport.width + 'px';
      interactionDiv.style.height = viewport.height + 'px';

  // Set up editing state
      this.currentPage = page;
      this.editCanvas = editCanvas;
      this.editContext = editCanvas.getContext('2d');
      this.pdfCanvas = pdfCanvas;
      this.interactionLayer = interactionDiv;
  this.canvasContainer = canvasContainer;
      this.editMode = 'view';
      this.textAnnotations = [];
      this.wipeAnnotations = [];
      this.actionHistory = []; // For undo functionality
      this.currentFont = 'Arial';
      this.currentFontSize = 16;
      this.currentColor = '#000000';
      // Track index of current page for numbering (manual mode start)
      this.currentPageIndex = this.pages.findIndex(p => p.id === page.id);

      // Store base dimensions for accurate saving
      const viewport1 = pdfPage.getViewport({ scale: 1.0 });
      this.baseCanvasWidth = viewport1.width;
      this.baseCanvasHeight = viewport1.height;

      // Add event listeners
      this.setupEditingEvents();

      // Assemble editor - PDF must be visible
      canvasContainer.appendChild(pdfCanvas);
      canvasContainer.appendChild(editCanvas);
      canvasContainer.appendChild(interactionDiv);
      
      editorContainer.appendChild(canvasContainer);
      content.appendChild(editorContainer);
      
      // Create and add toolbar to body for proper positioning
      const toolbar = this.createEditorToolbar();
      document.body.appendChild(toolbar);

      // Update overlay click behavior to prevent accidental closing
      overlay.onclick = null; // remove previous general click listener
      overlay.addEventListener('click', (e) => {
        // This event listener is intentionally left blank to prevent clicks on the
        // overlay from closing the editor. Closing is handled by the "Cancel" button.
        e.stopPropagation();
      });

      console.log('Edit mode setup complete');

    } catch (error) {
      console.error('Failed to enter edit mode:', error);
      alert('Failed to enter edit mode. Please try again.');
    }
  }

  createEditorToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';

    toolbar.innerHTML = `
      <button class="tool-btn" data-tool="add-text">Add Text</button>
      <button class="tool-btn" data-tool="wipe-text">Wipe Text</button>
      <button class="tool-btn" data-tool="page-number">Add Page Number</button>
      <button class="tool-btn" data-tool="undo" disabled>Undo</button>
      
      <div class="font-controls">
        <select id="font-family">
          <option value="Arial">Arial</option>
          <option value="Times">Times</option>
          <option value="Courier">Courier</option>
          <option value="Helvetica">Helvetica</option>
        </select>
        <input type="number" id="font-size" min="8" max="72" value="16" style="width: 60px;">
        <input type="color" id="text-color" value="#000000">
      </div>

      <div class="zoom-controls">
        <button class="zoom-btn" data-zoom="out">-</button>
        <span id="zoom-level">150%</span>
        <button class="zoom-btn" data-zoom="in">+</button>
      </div>

      <button class="tool-btn save" data-tool="save">Save Page</button>
      <button class="tool-btn" data-tool="cancel">Cancel</button>
    `;

    // Add event listeners
    toolbar.addEventListener('click', async (e) => {
      const tool = e.target.dataset.tool;
      const zoom = e.target.dataset.zoom;
      
      if (tool) {
        try {
          console.log('Tool clicked:', tool);
          await this.handleToolClick(tool, e.target);
          console.log('Tool click completed successfully:', tool);
        } catch (error) {
          console.error('Tool click failed:', tool, error);
          this.showStatus(`Failed to execute ${tool}: ${error.message}`, 'error');
        }
      } else if (zoom) {
        try {
          this.handleZoom(zoom);
        } catch (error) {
          console.error('Zoom failed:', zoom, error);
          this.showStatus(`Failed to zoom: ${error.message}`, 'error');
        }
      }
    });

    // Font controls
    toolbar.querySelector('#font-family').addEventListener('change', (e) => {
      this.currentFont = e.target.value;
    });

    toolbar.querySelector('#font-size').addEventListener('change', (e) => {
      this.currentFontSize = parseInt(e.target.value);
    });

    toolbar.querySelector('#text-color').addEventListener('change', (e) => {
      this.currentColor = e.target.value;
    });

    return toolbar;
  }

  setupEditingEvents() {
    let isWiping = false;
    let wipeStartX, wipeStartY;
    let selectionBox = null;

  this.interactionLayer.addEventListener('mousedown', (e) => {
      console.log('Mouse down, edit mode:', this.editMode);
      if (this.editMode === 'wipe-text') {
        console.log('Starting wipe selection');
        isWiping = true;
    // Compute coordinates relative to interaction layer to be robust with zoom
    const rect = this.interactionLayer.getBoundingClientRect();
    wipeStartX = e.clientX - rect.left;
    wipeStartY = e.clientY - rect.top;
        
        // Create selection box
        selectionBox = document.createElement('div');
        selectionBox.className = 'wipe-selection-box';
        this.interactionLayer.appendChild(selectionBox);
        
        this.interactionLayer.style.cursor = 'crosshair';
      }
    });

  this.interactionLayer.addEventListener('mousemove', (e) => {
      if (this.editMode === 'wipe-text' && isWiping) {
    const rectEl = this.interactionLayer.getBoundingClientRect();
    const currentX = e.clientX - rectEl.left;
    const currentY = e.clientY - rectEl.top;
        
        const rect = {
          x: Math.min(wipeStartX, currentX),
          y: Math.min(wipeStartY, currentY),
          width: Math.abs(currentX - wipeStartX),
          height: Math.abs(currentY - wipeStartY)
        };
        
        selectionBox.style.left = rect.x + 'px';
        selectionBox.style.top = rect.y + 'px';
        selectionBox.style.width = rect.width + 'px';
        selectionBox.style.height = rect.height + 'px';
      }
    });

  this.interactionLayer.addEventListener('mouseup', (e) => {
      if (this.editMode === 'wipe-text' && isWiping) {
        isWiping = false;
        
        // Remove selection box
        if (selectionBox) {
          this.interactionLayer.removeChild(selectionBox);
          selectionBox = null;
        }
        
  const rectEl = this.interactionLayer.getBoundingClientRect();
  const wipeEndX = e.clientX - rectEl.left;
  const wipeEndY = e.clientY - rectEl.top;
        
        const rect = {
          x: Math.min(wipeStartX, wipeEndX) / this.currentEditScale,
          y: Math.min(wipeStartY, wipeEndY) / this.currentEditScale,
          width: Math.abs(wipeEndX - wipeStartX) / this.currentEditScale,
          height: Math.abs(wipeEndY - wipeStartY) / this.currentEditScale
        };
        
        if (rect.width > 0 && rect.height > 0) {
          this.addWipeAnnotation(rect);
        }
      }
    });

    this.interactionLayer.addEventListener('click', (e) => {
      console.log('Interaction layer clicked, edit mode:', this.editMode);
      if (this.editMode === 'add-text') {
        console.log('Processing add text click');
        this.addTextAtPosition(e);
      }
    });
  }

  // ===== Zoom Handling =====
  async handleZoom(directionOrFactor) {
    try {
      // Determine new scale
      const step = 0.1;
      let scale = this.currentEditScale || 1.0;
      if (directionOrFactor === 'in') scale += step;
      else if (directionOrFactor === 'out') scale -= step;
      else if (typeof directionOrFactor === 'number') scale = directionOrFactor;
      // Clamp
      scale = Math.max(0.5, Math.min(3.0, scale));

      // No-op if unchanged
      if (Math.abs(scale - (this.currentEditScale || 1.0)) < 0.001) return;

      // Debounce zoom to prevent overlapping renders
      this._queuedScale = scale;
      if (this._zoomDebounceTimer) clearTimeout(this._zoomDebounceTimer);
      this._zoomDebounceTimer = setTimeout(async () => {
        // If a render is in progress, let rerenderEditView handle the queued scale
        if (this._renderInProgress) return;
        const next = this._queuedScale;
        this._queuedScale = null;
        this.currentEditScale = next;
        const zl = document.getElementById('zoom-level');
        if (zl) zl.textContent = `${Math.round(this.currentEditScale * 100)}%`;
        await this.rerenderEditView();
      }, 80);
    } catch (err) {
      console.error('Zoom failed:', err);
      this.showStatus(`Failed to zoom: ${err.message}`, 'error');
    }
  }

  async rerenderEditView() {
    if (!this.currentPage || !this.currentPage.pdfJSDoc || !this.pdfCanvas || !this.editCanvas || !this.interactionLayer) return;

    const page = await this.currentPage.pdfJSDoc.getPage(this.currentPage.filePageIndex + 1);
  const viewport = page.getViewport({ scale: this.currentEditScale || 1.0 });

    // Resize canvases
    this.pdfCanvas.width = viewport.width;
    this.pdfCanvas.height = viewport.height;
    this.editCanvas.width = viewport.width;
    this.editCanvas.height = viewport.height;
    this.interactionLayer.style.width = `${viewport.width}px`;
    this.interactionLayer.style.height = `${viewport.height}px`;

    // Render PDF layer with cancellation of previous task
    const ctx = this.pdfCanvas.getContext('2d');
    // Cancel any in-flight render
    if (this._pdfjsRenderTask && this._pdfjsRenderTask.cancel) {
      try { this._pdfjsRenderTask.cancel(); } catch {}
    }
    this._renderInProgress = true;
    const renderTask = page.render({ canvasContext: ctx, viewport });
    this._pdfjsRenderTask = renderTask;
    try {
      await renderTask.promise;
    } catch (e) {
      // Ignore cancellation
      if (e && String(e).toLowerCase().includes('cancel')) {
        // noop
      } else {
        throw e;
      }
    } finally {
      this._renderInProgress = false;
      // If a new scale was queued during render, apply it now
      if (this._queuedScale != null && Math.abs((this._queuedScale) - (this.currentEditScale || 1.0)) > 0.001) {
        const next = this._queuedScale;
        this._queuedScale = null;
        this.currentEditScale = next;
        const zl = document.getElementById('zoom-level');
        if (zl) zl.textContent = `${Math.round(this.currentEditScale * 100)}%`;
        await this.rerenderEditView();
        return;
      }
    }

    // Redraw overlays from base coordinates
    const ectx = this.editCanvas.getContext('2d');
    ectx.clearRect(0, 0, this.editCanvas.width, this.editCanvas.height);

    // Redraw text annotations
    if (Array.isArray(this.textAnnotations)) {
      for (const ann of this.textAnnotations) {
        const baseX = (ann.baseX != null) ? ann.baseX : ann.x; // fallback
        const baseY = (ann.baseY != null) ? ann.baseY : ann.y; // fallback
        const drawX = baseX * this.currentEditScale;
        const drawY = baseY * this.currentEditScale;
        ectx.save();
        ectx.fillStyle = ann.color || '#000000';
        const canvasFont = this.mapFontToCanvas(ann.font ? this.mapToolbarFontToStandard(ann.font) : this.currentFont);
        const fontPx = (ann.fontSize || 16) * this.currentEditScale;
        ectx.font = `${fontPx}px ${canvasFont}`;
        ectx.fillText(ann.text, drawX, drawY);
        ectx.restore();
        // Keep x/y in sync with current scale for preview and saving fallback
        ann.x = drawX;
        ann.y = drawY;
      }
    }

    // Redraw wipe annotations (stored in base units)
    if (Array.isArray(this.wipeAnnotations)) {
      for (const rect of this.wipeAnnotations) {
        const sx = rect.x * this.currentEditScale;
        const sy = rect.y * this.currentEditScale;
        const sw = rect.width * this.currentEditScale;
        const sh = rect.height * this.currentEditScale;
        ectx.save();
        ectx.fillStyle = '#ffffff';
        ectx.fillRect(sx, sy, sw, sh);
        ectx.strokeStyle = '#cccccc';
        ectx.lineWidth = 1;
        ectx.strokeRect(sx, sy, sw, sh);
        ectx.restore();
      }
    }
  }

  async handleToolClick(tool, button) {
    // Reset all buttons
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    // Remove any existing page-number overlay when switching tools
    if (tool !== 'page-number') {
      this.destroyPageNumberOverlay();
    }
    
    switch (tool) {
      case 'add-text':
        console.log('Add text mode activated');
        this.editMode = 'add-text';
        button.classList.add('active');
        this.interactionLayer.style.cursor = 'text';
        this.showStatus('Click anywhere on the page to add text', 'info');
        break;
      
      case 'wipe-text':
        console.log('Wipe text mode activated');
        this.editMode = 'wipe-text';
        button.classList.add('active');
        this.interactionLayer.style.cursor = 'crosshair';
        this.showStatus('Click and drag to select area to wipe', 'info');
        break;
      
      case 'page-number':
        button.classList.add('active');
  await this.openPageNumberDialog();
        break;
      
      case 'undo':
        this.undoLastAction();
        break;
        
      case 'save':
        try {
          // Show saving state
          button.textContent = 'Saving...';
          button.disabled = true;
          
          console.log('Starting save process...');
          await this.saveEditedPage();
          console.log('Save process completed successfully');
          
          // Button will be removed when edit mode exits, so no need to reset
        } catch (saveError) {
          console.error('Save failed in handleToolClick:', saveError);
          // Reset button state on error
          button.textContent = 'Save Page';
          button.disabled = false;
          // Re-throw to be caught by the outer try-catch
          throw saveError;
        }
        break;
        
      case 'cancel':
        this.exitEditMode();
        break;
    }
  }

  // ===== Page Numbering UI and Logic =====
  async openPageNumberDialog() {
    // Simple click-to-place page number mode
    try {
      if (!this.canvasContainer || !this.pdfCanvas || !this.interactionLayer) {
        this.showStatus('Page is not ready for numbering', 'error');
        return;
      }

      // If already in page-number mode, exit it
      if (this.editMode === 'page-number') {
        this.destroyPageNumberOverlay();
        return;
      }

      this.editMode = 'page-number';
      this.interactionLayer.style.cursor = 'crosshair';
      
      // Show instruction hint
      const hint = document.createElement('div');
      hint.id = 'page-number-hint';
      hint.textContent = 'Click anywhere on the page to place a page number. Press ESC to cancel.';
      Object.assign(hint.style, {
        position: 'fixed', 
        left: '50%', 
        top: '20px',
        transform: 'translateX(-50%)',
        padding: '8px 12px', 
        background: 'rgba(0,0,0,0.8)', 
        color: '#fff', 
        borderRadius: '6px',
        fontSize: '14px', 
        zIndex: 25,
        pointerEvents: 'none'
      });
      document.body.appendChild(hint);
      this._pnHint = hint;

      // Set up click handler for placing page numbers
      this._pageNumberClickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get click position relative to canvas
        const canvasRect = this.pdfCanvas.getBoundingClientRect();
        const clickX = e.clientX - canvasRect.left;
        const clickY = e.clientY - canvasRect.top;
        
        // Convert to normalized coordinates (0-1)
        const normX = clickX / canvasRect.width;
        const normY = clickY / canvasRect.height;
        
        console.log('Page number click at:', { clickX, clickY, normX, normY });
        
        // Create editable text directly on the page
        this.createPageNumberText(clickX, clickY, normX, normY);
      };

      this.interactionLayer.addEventListener('click', this._pageNumberClickHandler);

      // ESC to cancel
      this._pageNumberEscHandler = (e) => {
        if (e.key === 'Escape') {
          this.destroyPageNumberOverlay();
        }
      };
      document.addEventListener('keydown', this._pageNumberEscHandler);

      this.showStatus('Click anywhere on the page to place a page number. Press ESC to cancel.', 'info');
      
    } catch (err) {
      console.error('Failed to setup page numbering mode:', err);
      this.showStatus('Failed to setup page numbering mode', 'error');
    }
  }

  mapFontToCanvas(font) {
    switch (font) {
      case 'TimesRoman':
      case 'Times':
        return 'Times New Roman, Times, serif';
      case 'Courier':
        return 'Courier New, Courier, monospace';
      case 'Arial':
        return 'Arial, Helvetica, sans-serif';
      default:
        return 'Helvetica, Arial, sans-serif';
    }
  }

  mapToolbarFontToStandard(font) {
    switch ((font || '').toLowerCase()) {
      case 'times': return 'TimesRoman';
      case 'courier': return 'Courier';
      case 'arial':
      case 'helvetica':
      default: return 'Helvetica';
    }
  }

  createPageNumberText(canvasX, canvasY, normX, normY) {
    // Create editable text element directly on the page
    const textElement = document.createElement('div');
    textElement.className = 'page-number-text-edit';
    textElement.contentEditable = true;
    textElement.textContent = '1';
    
    // Get current toolbar styles
    const fontFamily = this.mapFontToCanvas(this.currentFont);
    const fontSize = this.currentFontSize;
    const color = this.currentColor;
    
    // Position relative to canvas
    const canvasRect = this.pdfCanvas.getBoundingClientRect();
    const absoluteX = canvasRect.left + canvasX;
    const absoluteY = canvasRect.top + canvasY;
    
    // Style the text element
    Object.assign(textElement.style, {
      position: 'absolute',
      left: (absoluteX - canvasRect.left) + 'px',
      top: (absoluteY - canvasRect.top) + 'px',
      fontFamily: fontFamily,
      fontSize: fontSize + 'px',
      color: color,
      background: 'rgba(255, 255, 255, 0.9)',
      border: '2px dashed #0078d4',
      padding: '4px 8px',
      borderRadius: '4px',
      zIndex: 60,
      cursor: 'text',
      outline: 'none',
      minWidth: '30px',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      userSelect: 'text'
    });
    
    // Add drag handle border for visual feedback
    const dragHandle = document.createElement('div');
    dragHandle.style.cssText = `
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px solid transparent;
      border-radius: 4px;
      pointer-events: none;
      z-index: -1;
    `;
    textElement.appendChild(dragHandle);
    
    // Add to the canvas container or modal
    const container = this.canvasContainer;
    container.appendChild(textElement);
    
    // Store reference for cleanup
    this._currentPageNumberText = textElement;
    
    // Make draggable
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isEditing = true; // Start in edit mode
    
    // Check if mouse is near border for drag cursor
    const isNearBorder = (e, element) => {
      const rect = element.getBoundingClientRect();
      const borderWidth = 8; // Pixels from edge to show drag cursor
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      return (x <= borderWidth || x >= rect.width - borderWidth ||
              y <= borderWidth || y >= rect.height - borderWidth);
    };
    
    // Update cursor based on mouse position
    const updateCursor = (e) => {
      if (isEditing) {
        if (isNearBorder(e, textElement)) {
          textElement.style.cursor = 'move';
        } else {
          textElement.style.cursor = 'text';
        }
      }
    };
    
    const startDrag = (e) => {
      // Only start drag if near border or not in edit mode
      if (isEditing && !isNearBorder(e, textElement)) {
        return;
      }
      
      isDragging = true;
      const rect = textElement.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      textElement.style.cursor = 'grabbing';
      textElement.contentEditable = 'false'; // Disable editing while dragging
      e.preventDefault();
      e.stopPropagation();
    };
    
    const doDrag = (e) => {
      if (!isDragging) return;
      
      const containerRect = container.getBoundingClientRect();
      const newX = Math.max(0, Math.min(containerRect.width - textElement.offsetWidth, e.clientX - containerRect.left - dragOffsetX));
      const newY = Math.max(0, Math.min(containerRect.height - textElement.offsetHeight, e.clientY - containerRect.top - dragOffsetY));
      
      textElement.style.left = newX + 'px';
      textElement.style.top = newY + 'px';
      
      // Update normalized coordinates
      const canvasRect = this.pdfCanvas.getBoundingClientRect();
      const textRect = textElement.getBoundingClientRect();
      const centerX = textRect.left + textRect.width / 2;
      const centerY = textRect.top + textRect.height / 2;
      
      if (centerX >= canvasRect.left && centerX <= canvasRect.right &&
          centerY >= canvasRect.top && centerY <= canvasRect.bottom) {
        normX = (centerX - canvasRect.left) / canvasRect.width;
        normY = (centerY - canvasRect.top) / canvasRect.height;
      }
    };
    
    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        textElement.contentEditable = 'true'; // Re-enable editing
        textElement.style.cursor = 'text';
      }
    };
    
    // Mouse move handler for cursor updates
    textElement.addEventListener('mousemove', updateCursor);
    
    // Mouse move handler for cursor updates
    textElement.addEventListener('mousemove', updateCursor);
    
    // Click handling - focus for editing, don't interfere with toolbar
    textElement.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isNearBorder(e, textElement)) {
        textElement.focus();
        // Select all text for easy editing
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(textElement);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
    
    // Add drag event listeners
    textElement.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', endDrag);
    
    // Store references for cleanup
    textElement._doDrag = doDrag;
    textElement._endDrag = endDrag;
    
    // Focus and select text initially
    textElement.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(textElement);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Handle Enter key to apply the page number
    const applyPageNumber = () => {
      const text = textElement.textContent.trim();
      const pageNumber = parseInt(text);
      
      if (isNaN(pageNumber) || pageNumber < 0) {
        this.showStatus('Please enter a valid page number', 'error');
        textElement.focus();
        return;
      }
      
      // Save settings using current toolbar styles
      const fontStandard = this.mapToolbarFontToStandard(this.currentFont);
      this.pageNumberSettings = {
        enabled: true,
        mode: 'manual',
        startNumber: pageNumber,
        font: fontStandard,
        fontSize: this.currentFontSize,
        color: this.currentColor,
        position: { normX, normY },
        applyToAll: false,
        startIndex: Number.isInteger(this.currentPageIndex) ? this.currentPageIndex : 0
      };
      
      // Draw on edit canvas
      try {
        const ctx = this.editContext;
        const px = canvasRect.width * normX;
        const py = canvasRect.height * normY;
        
        ctx.save();
        ctx.fillStyle = this.currentColor;
        ctx.font = `${this.currentFontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pageNumber), px, py);
        ctx.restore();
        
        console.log('Applied page number:', pageNumber, 'at position:', { px, py });
      } catch (e) {
        console.error('Failed to draw page number:', e);
      }
      
      // Clean up and exit
      this.cleanupPageNumberText();
      this.destroyPageNumberOverlay();
      this.showStatus(`Page number ${pageNumber} applied. It will be included when saving or merging.`, 'success');
    };
    
    // Update styles when toolbar changes
    const updateStyles = () => {
      if (this._currentPageNumberText) {
        this._currentPageNumberText.style.fontFamily = this.mapFontToCanvas(this.currentFont);
        this._currentPageNumberText.style.fontSize = this.currentFontSize + 'px';
        this._currentPageNumberText.style.color = this.currentColor;
      }
    };
    
    // Listen for toolbar changes
    this._pageNumberStyleUpdater = updateStyles;
    
    // Handle keyboard events - ONLY Enter applies the text
    textElement.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent event from bubbling up
      
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPageNumber();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cleanupPageNumberText();
        this.destroyPageNumberOverlay();
      }
    });
    
    // Prevent ANY automatic application - only Enter key should apply
    // No click outside handler that applies automatically
    const preventAutoApply = (e) => {
      // Just prevent clicks outside from applying
      // User must press Enter to apply
      e.stopPropagation();
    };
    
    // Store reference for cleanup
    this._preventAutoApply = preventAutoApply;
    
    // Add minimal click handling that doesn't auto-apply
    setTimeout(() => {
      document.addEventListener('click', preventAutoApply, true);
    }, 100);
    
    this.showStatus('Type page number and press ENTER to apply, or ESC to cancel. Hover border edges to drag.', 'info');
  }
  
  cleanupPageNumberText() {
    if (this._currentPageNumberText) {
      // Remove drag event listeners
      document.removeEventListener('mousemove', this._currentPageNumberText._doDrag);
      document.removeEventListener('mouseup', this._currentPageNumberText._endDrag);
      
      // Remove prevent auto-apply handler
      document.removeEventListener('click', this._preventAutoApply, true);
      
      if (this._currentPageNumberText.parentNode) {
        this._currentPageNumberText.parentNode.removeChild(this._currentPageNumberText);
      }
      this._currentPageNumberText = null;
    }
    this._pageNumberStyleUpdater = null;
    this._preventAutoApply = null;
  }

  destroyPageNumberOverlay() {
    // Clean up click-to-place mode
    if (this._pageNumberClickHandler && this.interactionLayer) {
      this.interactionLayer.removeEventListener('click', this._pageNumberClickHandler);
      this._pageNumberClickHandler = null;
    }
    
    if (this._pageNumberEscHandler) {
      document.removeEventListener('keydown', this._pageNumberEscHandler);
      this._pageNumberEscHandler = null;
    }
    
    if (this._pnHint && this._pnHint.parentNode) {
      this._pnHint.parentNode.removeChild(this._pnHint);
      this._pnHint = null;
    }

    // Clean up text element
    this.cleanupPageNumberText();

    // Legacy grid cleanup (if any old overlays exist)
    if (this._pnOverlayEl && this._pnOverlayEl.parentNode) {
      this._pnOverlayEl.parentNode.removeChild(this._pnOverlayEl);
    }
    if (this._pnOverlayHint && this._pnOverlayHint.parentNode) {
      this._pnOverlayHint.parentNode.removeChild(this._pnOverlayHint);
    }
    if (this._pnEscHandler) {
      document.removeEventListener('keydown', this._pnEscHandler);
      this._pnEscHandler = null;
    }
    
    // Restore interaction layer
    if (this.interactionLayer) {
      this.interactionLayer.style.pointerEvents = 'auto';
      this.interactionLayer.style.cursor = 'default';
    }
    
    this._pnOverlayEl = null;
    this._pnOverlayHint = null;
    if (this.editMode === 'page-number') this.editMode = 'view';
  }

  // ===== Text and Wipe Annotation Functions =====
  
  addTextAtPosition(e) {
  const rect = this.pdfCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
    
    // Create a text input at the clicked position
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter text...';
    input.style.position = 'absolute';
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.zIndex = '1000';
    input.style.border = '2px solid #0078d4';
    input.style.borderRadius = '4px';
    input.style.padding = '4px 8px';
    input.style.fontSize = this.currentFontSize + 'px';
    input.style.fontFamily = this.mapFontToCanvas(this.currentFont);
    input.style.color = this.currentColor;
    
    // Add to canvas container
    this.canvasContainer.appendChild(input);
    input.focus();
    
    // Handle Enter key to apply text
    input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
        const text = input.value.trim();
        if (text) {
          // Add text annotation
          const annotation = {
            text: text,
    // Store both display coords and base (unscaled) coords
    x: x,
    y: y,
    baseX: x / (this.currentEditScale || 1.0),
    baseY: y / (this.currentEditScale || 1.0),
            fontSize: this.currentFontSize,
            font: this.mapToolbarFontToStandard(this.currentFont),
            color: this.currentColor
          };
          
          this.textAnnotations.push(annotation);
          
          // Draw text on edit canvas
          const ctx = this.editContext;
          ctx.save();
          ctx.fillStyle = this.currentColor;
      ctx.font = `${this.currentEditScale ? this.currentEditScale * this.currentFontSize : this.currentFontSize}px ${this.mapFontToCanvas(this.currentFont)}`;
      ctx.fillText(text, x, y);
          ctx.restore();
          
          console.log('Text annotation added:', annotation);
          this.showStatus('Text added successfully', 'success');
        }
        
        // Remove input
        this.canvasContainer.removeChild(input);
      } else if (event.key === 'Escape') {
        // Cancel - just remove input
        this.canvasContainer.removeChild(input);
      }
    });
    
    // Handle click outside to cancel
    const clickOutside = (event) => {
      if (!input.contains(event.target)) {
        document.removeEventListener('click', clickOutside);
        if (input.parentNode) {
          this.canvasContainer.removeChild(input);
        }
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', clickOutside);
    }, 100);
  }
  
  addWipeAnnotation(rect) {
    // Add wipe annotation to the list
    const scale = this.currentEditScale || 1.0;
    const wipeRect = {
      // display coords (current scale)
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      // base coords (unscaled)
      baseX: rect.x / scale,
      baseY: rect.y / scale,
      baseWidth: rect.width / scale,
      baseHeight: rect.height / scale
    };
    
    this.wipeAnnotations.push(wipeRect);
    
    // Draw white rectangle on edit canvas
    const ctx = this.editContext;
    ctx.save();
    ctx.fillStyle = '#ffffff';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
    
    console.log('Wipe annotation added:', wipeRect);
    this.showStatus('Area wiped successfully', 'success');
  }

  async saveEditedPage() {
    this.showLoading('Saving page edits...');
    try {
      console.log('=== SAVE EDITED PAGE START ===');
      console.log('Current page info:', {
        id: this.currentPage?.id,
        fileName: this.currentPage?.fileName,
        isModified: this.currentPage?.isModified,
        hasOriginalPdfDoc: !!this.currentPage?.pdfDoc
      });
      console.log('Saving edited page with', this.textAnnotations.length, 'text annotations and', this.wipeAnnotations.length, 'wipe annotations.');
      
      // Load PDFLib if not already loaded
      const pdfLib = await this.loadPDFLib();
      console.log('PDFLib loaded successfully');
      
      // Create new PDF page with modifications
      const pdfDoc = await pdfLib.PDFDocument.create();
      const [existingPage] = await pdfDoc.copyPages(this.currentPage.pdfDoc, [this.currentPage.filePageIndex]);
      const page = pdfDoc.addPage(existingPage);
      
      // Get the original PDF page viewport at scale 1.0 to calculate the correct scaling factor
      const scaleFactor = page.getWidth() / this.baseCanvasWidth;

      // Add text annotations to PDF
      for (const annotation of this.textAnnotations) {
        const pageHeight = page.getHeight();
        const baseX = (annotation.baseX != null) ? annotation.baseX : annotation.x / (this.currentEditScale || 1.0);
        const baseY = (annotation.baseY != null) ? annotation.baseY : annotation.y / (this.currentEditScale || 1.0);
        page.drawText(annotation.text, {
          x: baseX * scaleFactor,
          y: pageHeight - (baseY * scaleFactor) - (annotation.fontSize * scaleFactor * 0.2), // Fine-tune baseline
          size: annotation.fontSize * scaleFactor,
          font: await pdfDoc.embedFont(pdfLib.StandardFonts[annotation.font] || pdfLib.StandardFonts.Helvetica),
          color: pdfLib.rgb(
            parseInt(annotation.color.slice(1, 3), 16) / 255,
            parseInt(annotation.color.slice(3, 5), 16) / 255,
            parseInt(annotation.color.slice(5, 7), 16) / 255
          )
        });
      }
      
      // Add wipe annotations to PDF
      if (this.wipeAnnotations) {
        for (const rect of this.wipeAnnotations) {
          const pageHeight = page.getHeight();
          const baseX = (rect.baseX != null) ? rect.baseX : rect.x / (this.currentEditScale || 1.0);
          const baseY = (rect.baseY != null) ? rect.baseY : rect.y / (this.currentEditScale || 1.0);
          const baseW = (rect.baseWidth != null) ? rect.baseWidth : rect.width / (this.currentEditScale || 1.0);
          const baseH = (rect.baseHeight != null) ? rect.baseHeight : rect.height / (this.currentEditScale || 1.0);
          page.drawRectangle({
            x: baseX * scaleFactor,
            y: pageHeight - ((baseY + baseH) * scaleFactor),
            width: baseW * scaleFactor,
            height: baseH * scaleFactor,
            color: pdfLib.rgb(1, 1, 1), // White
            opacity: 1,
          });
        }
      }

      // Manual numbering for single page if chosen not to apply to all
      if (this.pageNumberSettings?.enabled && this.pageNumberSettings.mode === 'manual' && !this.pageNumberSettings.applyToAll) {
        const num = this.pageNumberSettings.startNumber || 1;
        await this.drawPageNumberOnPdfLibPage(
          pdfLib,
          pdfDoc,
          page,
          num,
          this.pageNumberSettings.position,
          this.pageNumberSettings.font,
          this.pageNumberSettings.fontSize,
          this.pageNumberSettings.color
        );
      }

      // Generate the updated PDF bytes
      const pdfBytes = await pdfDoc.save();
      console.log('PDF saved, bytes length:', pdfBytes.length);
      console.log('PDF bytes type:', typeof pdfBytes);
      console.log('PDF bytes constructor:', pdfBytes.constructor.name);
      console.log('PDF bytes is Uint8Array:', pdfBytes instanceof Uint8Array);
      
      // Validate PDF data
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error('Generated PDF data is empty');
      }
      
      // Ensure we have a proper Uint8Array
      let validPdfBytes;
      if (pdfBytes instanceof Uint8Array) {
        validPdfBytes = pdfBytes;
      } else if (Array.isArray(pdfBytes)) {
        validPdfBytes = new Uint8Array(pdfBytes);
        console.log('✅ Converted array to Uint8Array');
      } else {
        throw new Error('Invalid PDF data type: ' + typeof pdfBytes);
      }
      
      // Test loading the PDF to ensure it's valid
      try {
        const testPdf = await pdfLib.PDFDocument.load(validPdfBytes);
        console.log('✅ PDF validation successful, pages:', testPdf.getPageCount());
      } catch (validationError) {
        console.error('❌ PDF validation failed:', validationError);
        throw new Error('Generated PDF is corrupted: ' + validationError.message);
      }
      
      // Update the page data in our system with backup
      this.currentPage.pdfData = validPdfBytes;
      this.currentPage.isModified = true;
      
      // Create a backup in the global pages array as well
      const pageIndex = this.pages.findIndex(p => p.id === this.currentPage.id);
      if (pageIndex !== -1) {
        this.pages[pageIndex].pdfData = validPdfBytes;
        this.pages[pageIndex].isModified = true;
        console.log('✅ Backup PDF data stored in pages array');
        console.log('Backup data type:', this.pages[pageIndex].pdfData.constructor.name);
        console.log('Backup data size:', this.pages[pageIndex].pdfData.length);
      } else {
        console.warn('⚠️ Could not find page in pages array for backup');
      }
      
      // For edited pages, the filePageIndex should be 0 since we create a single-page PDF
      this.currentPage.editedPageIndex = 0;
      
      // Reload the PDF for future operations
      const updatedPdfDoc = await pdfLib.PDFDocument.load(validPdfBytes);
      this.currentPage.pdfDoc = updatedPdfDoc;
      
      // Also update PDF.js document for previews
      try {
        // Pass a copy of the data to PDF.js to prevent the original buffer from being detached.
        // This is the crucial fix for the "detached ArrayBuffer" error.
        const pdfDataForPreview = new Uint8Array(validPdfBytes);
        const updatedPdfJSDoc = await pdfjsLib.getDocument({data: pdfDataForPreview}).promise;
        this.currentPage.pdfJSDoc = updatedPdfJSDoc;
        console.log('✅ PDF.js document updated, pages:', updatedPdfJSDoc.numPages);
      } catch (pdfjsError) {
        console.error('❌ Failed to load PDF with PDF.js:', pdfjsError);
        throw new Error('Failed to create PDF.js document: ' + pdfjsError.message);
      }
      
      console.log('Page data updated successfully');
      
      // Final validation: Ensure the data persisted correctly
      console.log('Final validation:');
      console.log('- currentPage.pdfData size:', this.currentPage.pdfData ? this.currentPage.pdfData.length : 0);
      console.log('- currentPage.pdfData type:', this.currentPage.pdfData ? this.currentPage.pdfData.constructor.name : 'none');
      console.log('- currentPage.isModified:', this.currentPage.isModified);
      
      const pageInArray = this.pages.find(p => p.id === this.currentPage.id);
      if (pageInArray) {
        console.log('- pages array backup size:', pageInArray.pdfData ? pageInArray.pdfData.length : 0);
        console.log('- pages array backup type:', pageInArray.pdfData ? pageInArray.pdfData.constructor.name : 'none');
        console.log('- pages array isModified:', pageInArray.isModified);
      }
      
      // Regenerate preview with the updated PDF
      await this.regeneratePagePreview(this.currentPage);
      
      // Exit edit mode
      this.exitEditMode();
      
      // Show success message
      this.hideLoading();
      console.log('=== SAVE EDITED PAGE SUCCESS ===');
      console.log('Page saved successfully');
      this.showToast('Page saved successfully!', 'success');
      
    } catch (error) {
      this.hideLoading();
      console.error('=== SAVE EDITED PAGE FAILED ===');
      console.error('Failed to save edited page:', error);
      console.error('Error details:', error.message);
      console.error('Current page state:', this.currentPage);
      this.showToast(`Failed to save page: ${error.message}`, 'error');
    }
  }

  async regeneratePagePreview(page) {
    try {
      console.log('Regenerating preview for page:', page.id);
      console.log('Page has pdfData:', !!page.pdfData);
      console.log('PDF data size:', page.pdfData ? page.pdfData.length : 0);
      
      // Find the page card and update its preview
      const pageCards = document.querySelectorAll('.page-card');
      console.log('Found page cards:', pageCards.length);
      
      let cardFound = false;
      for (const card of pageCards) {
        console.log('Checking card with pageId:', card.dataset.pageId, 'vs target:', page.id);
        if (card.dataset.pageId === page.id) {
          cardFound = true;
          console.log('Found matching page card');
          
          const previewDiv = card.querySelector('.page-preview');
          if (previewDiv) {
            // Validate we have the necessary data
            if (!page.pdfJSDoc) {
              console.error('❌ Missing pdfJSDoc for page:', page.id);
              previewDiv.innerHTML = '<div class="page-placeholder">📄<br>No PDF data</div>';
              return;
            }
            
            console.log('Updating preview with new PDF data...');
            console.log('PDF document info:', {
              numPages: page.pdfJSDoc.numPages,
              isModified: page.isModified,
              originalFilePageIndex: page.filePageIndex
            });
            
            // Add loading indicator
            previewDiv.innerHTML = '<div class="updating-preview">🔄 Updating...</div>';
            
            // Small delay to show the loading indicator
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Re-render the preview with updated data
            // For edited pages, use index 0 since they become single-page PDFs
            const pageIndexToRender = page.isModified ? 0 : page.filePageIndex;
            console.log('Rendering page with index:', pageIndexToRender, '(isModified:', page.isModified, ')');
            
            await this.renderPageToDiv(page.pdfJSDoc, pageIndexToRender, previewDiv);
            
            // Add visual indicator that page was edited
            card.classList.add('page-edited');
            
            console.log('Page preview regenerated successfully');
          } else {
            console.error('Missing preview div for page:', page.id);
          }
          break;
        }
      }
      
      if (!cardFound) {
        console.error('Could not find page card with ID:', page.id);
      }
      
    } catch (error) {
      console.error('Failed to regenerate page preview:', error);
    }
  }

  exitEditMode(overlay = null) {
    console.log('Exiting edit mode...');
  // Clean up any page-number overlay
  this.destroyPageNumberOverlay();
    
    // Remove toolbar from body
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
      document.body.removeChild(toolbar);
      console.log('Toolbar removed');
    }
    
    if (overlay) {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        console.log('Overlay removed');
      }
    } else {
      // Find and remove the overlay
      const existingOverlay = document.querySelector('.page-fullscreen-overlay');
      if (existingOverlay && existingOverlay.parentNode) {
        existingOverlay.parentNode.removeChild(existingOverlay);
        console.log('Existing overlay removed');
      }
    }
    
    // Clean up editing state
    this.editMode = 'view';
    this.textAnnotations = [];
    this.wipeAnnotations = [];
    this.actionHistory = [];
    this.currentPage = null;
    
    // Make sure the main modal is still visible
    const modal = document.getElementById('page-preview-modal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('Main modal restored');
    }
    
    console.log('Edit mode exited successfully');
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

  movePageToPosition(draggedIndex, insertIndex) {
    if (draggedIndex === insertIndex) return;
    
    // Adjust insert index if dragging from before the insert position
    let targetIndex = insertIndex;
    if (draggedIndex < insertIndex) {
      targetIndex = insertIndex - 1;
    }
    
    const movedPage = this.pages.splice(draggedIndex, 1)[0];
    this.pages.splice(targetIndex, 0, movedPage);
    
    // Update global page numbers
    this.pages.forEach((page, index) => {
      page.globalPageNumber = index + 1;
    });
    
    console.log(`Moved page from position ${draggedIndex} to insert position ${insertIndex} (actual position ${targetIndex})`);
    this.renderPagePreviews(); // Re-render to update positions
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
    console.log('Pages to merge:', this.pages.map(p => ({ id: p.id, isModified: p.isModified, fileName: p.fileName })));
    
    // Pre-merge data integrity check
    console.log('=== PRE-MERGE DATA INTEGRITY CHECK ===');
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      console.log(`Page ${i + 1}: ${page.id}`);
      console.log('- isModified:', page.isModified);
      console.log('- hasPdfData:', !!page.pdfData);
      console.log('- pdfDataType:', page.pdfData ? page.pdfData.constructor.name : 'none');
      console.log('- pdfDataSize:', page.pdfData ? page.pdfData.length : 0);
      
      if (page.isModified && (!page.pdfData || page.pdfData.length === 0)) {
        console.error('❌ CRITICAL: Modified page missing PDF data before merge!');
        console.error('Page details:', page);
      }
    }
    console.log('=== END PRE-MERGE CHECK ===');
    
    // Disable the button to prevent multiple clicks
    if (this.elements.completeMergeBtn) {
      this.elements.completeMergeBtn.disabled = true;
      this.elements.completeMergeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2v20m0-20l4 4m-4-4L8 6"></path>
        </svg>
        Merging...
      `;
    }
    
    this.closePagePreviewModal();
    this.showLoading('Merging PDF pages...');

    try {
      const pdfLib = await this.loadPDFLib();
      const mergedPdf = await pdfLib.PDFDocument.create();

      // Add pages in the order they appear in the modal
      for (let i = 0; i < this.pages.length; i++) {
        const page = this.pages[i];
        console.log(`Processing page ${i + 1}/${this.pages.length}: ${page.fileName} (modified: ${page.isModified})`);
        console.log('Page debug info:', {
          id: page.id,
          isModified: page.isModified,
          hasPdfData: !!page.pdfData,
          pdfDataType: typeof page.pdfData,
          pdfDataSize: page.pdfData ? page.pdfData.length : 0,
          pdfDataConstructor: page.pdfData ? page.pdfData.constructor.name : 'none',
          hasPdfDoc: !!page.pdfDoc,
          filePageIndex: page.filePageIndex
        });
        
        // Additional debugging for pdfData
        if (page.isModified) {
          console.log('Detailed pdfData analysis:');
          console.log('- pdfData is null:', page.pdfData === null);
          console.log('- pdfData is undefined:', page.pdfData === undefined);
          console.log('- pdfData is array:', Array.isArray(page.pdfData));
          console.log('- pdfData length > 0:', page.pdfData && page.pdfData.length > 0);
          
          if (page.pdfData) {
            // Create a copy to avoid detached buffer issues
            const dataCopy = new Uint8Array(page.pdfData);
            console.log('- First 20 bytes:', Array.from(dataCopy.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          }
        }
        
        let sourcePdf;
        
        if (page.isModified) {
          console.log('Processing modified page:', page.id);
          
          // Check if we have valid PDF data
          const hasValidPdfData = page.pdfData && 
                                 (page.pdfData instanceof Uint8Array || Array.isArray(page.pdfData)) && 
                                 page.pdfData.length > 0;
          
          console.log('PDF data validation:', {
            exists: !!page.pdfData,
            isUint8Array: page.pdfData instanceof Uint8Array,
            isArray: Array.isArray(page.pdfData),
            hasLength: page.pdfData && page.pdfData.length > 0,
            isValid: hasValidPdfData
          });
          
          if (hasValidPdfData) {
            // Use the edited PDF data for modified pages
            console.log('✅ Using edited PDF data for page:', page.id);
            console.log('PDF data size:', page.pdfData.length, 'bytes');
            
            try {
              // Pass a copy of the data to prevent detached buffer issues
              const dataCopy = new Uint8Array(page.pdfData);
              sourcePdf = await pdfLib.PDFDocument.load(dataCopy);
              console.log('✅ Edited PDF loaded successfully, pages:', sourcePdf.getPageCount());
              
              // For edited pages, we want the first (and only) page since we saved it as a single page
              const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [0]);
              await this.maybeDrawPageNumber(pdfLib, mergedPdf, copiedPage, i);
              mergedPdf.addPage(copiedPage);
            } catch (loadError) {
              console.error('❌ Failed to load edited PDF data:', loadError);
              if (page.pdfData) {
                console.error('PDF data preview (first 100 bytes):', Array.from(new Uint8Array(page.pdfData).slice(0, 100)));
              }
              throw new Error(`Failed to load edited PDF for page ${page.id}: ${loadError.message}`);
            }
          } else {
            console.error('❌ Invalid or missing PDF data for modified page:', page.id);
            
            // Try to recover from pages array backup
            const pageBackup = this.pages.find(p => p.id === page.id);
            if (pageBackup && pageBackup.pdfData && pageBackup.pdfData.length > 0) {
              console.log('🔄 Attempting to recover PDF data from backup...');
              page.pdfData = pageBackup.pdfData;
              console.log('✅ PDF data recovered from backup, size:', page.pdfData.length);
              
              // Retry the edited page process
              try {
                const dataCopy = new Uint8Array(page.pdfData);
                sourcePdf = await pdfLib.PDFDocument.load(dataCopy);
                console.log('✅ Recovered PDF loaded successfully, pages:', sourcePdf.getPageCount());
                
                const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [0]);
                await this.maybeDrawPageNumber(pdfLib, mergedPdf, copiedPage, i);
                mergedPdf.addPage(copiedPage);
              } catch (recoveryError) {
                console.error('❌ Failed to load recovered PDF data:', recoveryError);
                throw new Error(`Failed to recover PDF data for page ${page.id}: ${recoveryError.message}`);
              }
            } else {
              console.error('❌ No backup data available for page:', page.id);
              throw new Error(`Modified page ${page.id} is missing PDF data and no backup found. Please re-edit and save the page.`);
            }
          }
        } else {
          // Use original PDF document for unmodified pages
          console.log('Using original PDF data for page:', page.id);
          const [copiedPage] = await mergedPdf.copyPages(page.pdfDoc, [page.filePageIndex]);
          await this.maybeDrawPageNumber(pdfLib, mergedPdf, copiedPage, i);
          mergedPdf.addPage(copiedPage);
        }
        
        // Update progress
        if (this.pageNumberSettings?.enabled) {
          this.updateLoadingMessage(`Processing page ${i + 1} of ${this.pages.length} (adding page numbers)...`);
        } else {
          this.updateLoadingMessage(`Processing page ${i + 1} of ${this.pages.length}...`);
        }
      }

      this.updateLoadingMessage('Finalizing document...');
      this.mergedPdfData = await mergedPdf.save();
      
      this.hideLoading();
      this.showDownloadSection();
      this.showStatus('✅ Merge completed successfully! Your edits have been included.', 'success');
      
      console.log('✅ PDF merge completed successfully');

    } catch (error) {
      console.error('❌ Merge failed:', error);
      this.hideLoading();
      this.showStatus(`Merge failed: ${error.message}`, 'error');
      
      // Re-enable the button on error
      if (this.elements.completeMergeBtn) {
        this.elements.completeMergeBtn.disabled = false;
        this.elements.completeMergeBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          Complete Merge
        `;
      }
    }
  }

  async maybeDrawPageNumber(pdfLib, pdfDoc, page, pageIndex) {
    try {
      const s = this.pageNumberSettings;
      if (!s || !s.enabled) return;

      if (s.mode === 'auto') {
        // Auto: number from 1 to N regardless of selection
        const number = (pageIndex + 1);
        await this.drawPageNumberOnPdfLibPage(pdfLib, pdfDoc, page, number, s.position, s.font, s.fontSize, s.color);
      } else {
        if (s.applyToAll) {
          if (pageIndex >= (s.startIndex || 0)) {
            const delta = pageIndex - (s.startIndex || 0);
            const number = (s.startNumber || 1) + delta;
            await this.drawPageNumberOnPdfLibPage(pdfLib, pdfDoc, page, number, s.position, s.font, s.fontSize, s.color);
          }
        } else {
          if (pageIndex === (s.startIndex || 0)) {
            const number = s.startNumber || 1;
            await this.drawPageNumberOnPdfLibPage(pdfLib, pdfDoc, page, number, s.position, s.font, s.fontSize, s.color);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to draw page number:', e);
    }
  }

  async drawPageNumberOnPdfLibPage(pdfLib, pdfDoc, page, number, position, fontName, fontSize, colorHex) {
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = pageWidth * (position?.normX ?? 0.5);
    const yTop = pageHeight * (position?.normY ?? 0.95);
    const y = pageHeight - yTop;

    const std = pdfLib.StandardFonts;
    const family = (fontName === 'TimesRoman' ? std.TimesRoman : fontName === 'Courier' ? std.Courier : std.Helvetica);
    const font = await pdfDoc.embedFont(family);

    const r = parseInt(colorHex.slice(1, 3), 16) / 255;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255;

    page.drawText(String(number), { x, y: y - fontSize * 0.2, size: fontSize, font, color: pdfLib.rgb(r, g, b) });
  }

  // ===== Loading Methods =====
  showLoading(message) {
    if (this.elements?.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    if (this.elements?.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
  }

  updateLoadingMessage(message) {
    if (this.elements?.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
  }

  hideLoading() {
    if (this.elements?.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // ===== Status Methods =====
  showStatus(message, type = 'info') {
    // Route to toast if available, else console
    if (this.elements?.toastContainer) {
      this.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  showReadyState() {
    // No-op placeholder for initial ready state; keeps API stable
  }

  showError(message) {
    this.showStatus(message, 'error');
  }

  // ===== Utility Methods =====
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

  // ===== Toast Notification Methods =====
  showToast(message, type = 'success', duration = 5000) {
    if (!this.elements?.toastContainer) {
      console.warn('Toast container not found');
      return;
    }
    const toast = this.createToastElement(message, type);
    this.elements.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const autoRemoveTimer = setTimeout(() => this.removeToast(toast), duration);
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
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.removeToast(toast));
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
    if (toast._autoRemoveTimer) clearTimeout(toast._autoRemoveTimer);
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }

  showDownloadSection() {
    if (this.elements.downloadSection) {
      this.elements.downloadSection.style.display = 'block';
      this.elements.downloadSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async downloadMergedFile() {
    if (!this.mergedPdfData) {
      this.showStatus('No merged PDF data available', 'error');
      return;
    }

    try {
      // Get selected compression level
      const selectedCompression = document.querySelector('input[name="download-compression"]:checked');
      const compressionLevel = selectedCompression ? selectedCompression.value : 'medium';
      
      this.showLoading('Preparing download...');
      
      let finalPdfData = this.mergedPdfData;
      
      // Apply compression if needed
      if (compressionLevel !== 'none') {
        this.updateLoadingMessage('Compressing PDF...');
        finalPdfData = await this.compressPdf(this.mergedPdfData, compressionLevel);
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `merged-pdf-${timestamp}.pdf`;

      this.hideLoading();

      // Try modern download approach first
      if (this.tryModernDownload(finalPdfData, filename)) {
        this.showStatus(`PDF downloaded successfully as ${filename}`, 'success');
        return;
      }

      // Fallback to traditional method
      this.tryTraditionalDownload(finalPdfData, filename);
      this.showStatus(`PDF downloaded successfully as ${filename}`, 'success');
      
    } catch (error) {
      console.error('Download failed:', error);
      this.hideLoading();
      this.showStatus(`Download failed: ${error.message}`, 'error');
    }
  }

  tryModernDownload(pdfData, filename) {
    // Use the File System Access API if available (Chrome 86+)
    if ('showSaveFilePicker' in window) {
      this.showModernSaveDialog(pdfData, filename);
      return true;
    }
    return false;
  }

  async showModernSaveDialog(pdfData, filename) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'PDF files',
          accept: { 'application/pdf': ['.pdf'] }
        }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(pdfData);
      await writable.close();
      
      this.showStatus('PDF saved successfully!', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Modern save failed:', error);
        // Fall back to traditional download
        this.tryTraditionalDownload(pdfData, filename);
      }
    }
  }

  tryTraditionalDownload(pdfData, filename) {
    // Create download link
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    
    // Add user instruction for permission
    this.showStatus('Click "Allow" if your browser asks for download permission', 'info');
    
    // Trigger download
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async compressPdf(pdfData, compressionLevel) {
    try {
      // For now, return the original data
      // In a full implementation, you might use pdf-lib compression features
      // or send to a compression service
      
      const compressionRatios = {
        'low': 0.9,
        'medium': 0.7,
        'high': 0.5
      };
      
      // This is a placeholder - actual PDF compression would require
      // more sophisticated processing
      console.log(`Applying ${compressionLevel} compression (${compressionRatios[compressionLevel] * 100}% quality)`);
      
      return pdfData; // Return uncompressed for now
      
    } catch (error) {
      console.warn('Compression failed, returning original:', error);
      return pdfData;
    }
  }

  // ...existing code...
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
