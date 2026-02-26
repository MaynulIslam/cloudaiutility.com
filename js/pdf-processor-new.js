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
    // REMOVED: Editing-related variables - no longer needed
    
    // REMOVED: Professional annotation system - no longer needed
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
    
    // Compression radio buttons - update size display when selection changes
    if (this.elements.compressionRadios) {
      this.elements.compressionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          this.updateSelectedCompressionDisplay();
        });
      });
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

      // Removed: Edit this page button (no longer needed)

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
        content.appendChild(frame);
      } else {
        content.innerHTML = '<div style="color: #666; font-size: 3rem;">📄</div>';
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

  // REMOVED: enterEditMode function - no longer needed for simplified PDF merge tool
  
  // REMOVED: initializeAnnotationManager - no longer needed
  
  // REMOVED: updateToolbarState - no longer needed
  
  // REMOVED: updateViewportTransform - no longer needed
  
  // REMOVED: redrawAnnotations - no longer needed
  
  // REMOVED: setupViewportControls - no longer needed
  
  // REMOVED: isEditingAnnotation - no longer needed
  
  // REMOVED: screenToPdfCoords - no longer needed
  // REMOVED: pdfToScreenCoords - no longer needed

  // REMOVED: createEditorToolbar - no longer needed

  // REMOVED: setupEditingEvents - no longer needed

  // REMOVED: handleZoom - no longer needed
  // REMOVED: handleLegacyZoom - no longer needed

  // REMOVED: rerenderEditView - no longer needed

  // REMOVED: enableEditTextMode - no longer needed

  // REMOVED: disableEditTextMode - no longer needed

  // REMOVED: buildTextOverlay - no longer needed

  // REMOVED: startTextEdit - no longer needed

  // REMOVED: handleToolClick - no longer needed

  // REMOVED: openPageNumberDialog - no longer needed

  // REMOVED: mapFontToCanvas - no longer needed

  // REMOVED: mapToolbarFontToStandard - no longer needed

  // REMOVED: createPageNumberText - no longer needed
  
  // REMOVED: cleanupPageNumberText - no longer needed

  // REMOVED: destroyPageNumberOverlay - no longer needed

  // ===== Text and Wipe Annotation Functions =====
  
  // REMOVED: addTextAtPosition - no longer needed
  
  // REMOVED: makeTextEditorDraggable - no longer needed
  
  // REMOVED: getTextAnnotationAtPosition - no longer needed
  
  // REMOVED: editExistingText - no longer needed
  
  // REMOVED: addWipeAnnotation - no longer needed

  // REMOVED: saveEditedPage - no longer needed

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

  // REMOVED: exitEditMode - no longer needed

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
      
      // Calculate and display file sizes for each compression option
      this.updateCompressionSizes();
    }
  }
  
  async updateCompressionSizes() {
    if (!this.mergedPdfData) return;
    
    const originalSize = this.mergedPdfData.byteLength;
    
    // Update "No Compression" size
    const sizeNone = document.getElementById('size-none');
    if (sizeNone) {
      sizeNone.textContent = this.formatFileSize(originalSize);
    }
    
    // Estimate sizes for different compression levels
    // These are estimates based on typical compression ratios
    const compressionRatios = {
      'standard': 0.7,  // 30% reduction
      'strong': 0.4     // 60% reduction
    };
    
    // Update "Standard" compression size
    const sizeStandard = document.getElementById('size-standard');
    if (sizeStandard) {
      const estimatedSize = Math.round(originalSize * compressionRatios.standard);
      const reduction = Math.round((1 - compressionRatios.standard) * 100);
      sizeStandard.textContent = `~${this.formatFileSize(estimatedSize)} (-${reduction}%)`;
    }
    
    // Update "Strong" compression size
    const sizeStrong = document.getElementById('size-strong');
    if (sizeStrong) {
      const estimatedSize = Math.round(originalSize * compressionRatios.strong);
      const reduction = Math.round((1 - compressionRatios.strong) * 100);
      sizeStrong.textContent = `~${this.formatFileSize(estimatedSize)} (-${reduction}%)`;
    }
    
    // Update the selected option display
    this.updateSelectedCompressionDisplay();
  }
  
  updateSelectedCompressionDisplay() {
    // Highlight the selected compression option
    const selectedRadio = document.querySelector('input[name="download-compression"]:checked');
    if (selectedRadio) {
      // Remove highlight from all options
      document.querySelectorAll('.radio-option').forEach(option => {
        option.classList.remove('selected');
      });
      
      // Add highlight to selected option
      const selectedOption = selectedRadio.closest('.radio-option');
      if (selectedOption) {
        selectedOption.classList.add('selected');
      }
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
      // Client-side compression using pdf-lib
      // This provides basic compression by optimizing the PDF structure
      try {
        const { PDFDocument } = window.pdfLib;
        const pdfDoc = await PDFDocument.load(pdfData);
        
        // Compression options based on level
        const saveOptions = {
          useObjectStreams: true,  // Enable object stream compression
          addDefaultPage: false,
          objectsPerTick: 50
        };
        
        if (compressionLevel === 'strong') {
          // For strong compression, we can try to optimize images and fonts
          // Note: This is a simplified approach - real image compression would require more work
          saveOptions.useObjectStreams = true;
          saveOptions.compress = true;
        }
        
        const compressedPdfData = await pdfDoc.save(saveOptions);
        
        const reduction = Math.round((1 - compressedPdfData.byteLength / pdfData.byteLength) * 100);
        console.log(`✅ Client-side compression: ${this.formatFileSize(pdfData.byteLength)} → ${this.formatFileSize(compressedPdfData.byteLength)} (${reduction}% reduction)`);
        
        return compressedPdfData;
      } catch (error) {
        console.warn('Client-side compression failed:', error);
        return pdfData;
      }
      
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
