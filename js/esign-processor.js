// eSign Processor JavaScript Module
class ESignProcessor {
    constructor() {
        this.uploadedFile = null;
        this.signers = [];
        this.signatureFields = [];
        this.currentFieldType = 'signature';
        this.selectedField = null;
        this.pdfDocument = null;
        this.currentPage = 1;
    this.scale = 1.2;
        this.minScale = 0.5;
        this.maxScale = 3.0;
        this.scaleStep = 0.2;
    // Rendering state (no interactive zoom)
    this.currentRenderTask = null;
    this.isRendering = false;
    this.pageDirection = null; // 'from-right' or 'from-left' for animation
        // When true, control change handlers should not apply changes to fields (used during programmatic updates)
        this.suppressStyleUpdates = false;
        
    this.initializeElements();
    this.setupEventListeners();

    // in-memory action log for debugging (exposed via window for easy access)
    this.actionLogs = [];
    this.log('eSign initialized', { currentPage: this.currentPage });
    }

    initializeElements() {
        // Upload elements
        this.dropArea = document.getElementById('drop-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        this.fileInfo = document.getElementById('file-info');
        this.prepareBtn = document.getElementById('prepare-document-btn');
        
        // Configuration elements
        this.configSection = document.getElementById('signature-config-section');
        this.signerName = document.getElementById('signer-name');
        this.signerEmail = document.getElementById('signer-email');
        this.addSignerBtn = document.getElementById('add-signer-btn');
        this.signersList = document.getElementById('signers-list');
        this.addFieldsBtn = document.getElementById('add-signature-fields-btn');
        
        // Send elements
        this.sendSection = document.getElementById('send-section');
        this.signatureMessage = document.getElementById('signature-message');
        this.sendSummary = document.getElementById('send-summary-content');
        this.sendBtn = document.getElementById('send-for-signature-btn');
        
        // Modal elements
        this.modal = document.getElementById('document-preview-modal');
        this.closeModalBtn = document.getElementById('close-modal');
        this.documentPagesContainer = document.getElementById('document-pages-container');
    // Removed signer selection as it is no longer required
        this.completeSetupBtn = document.getElementById('complete-setup-btn');
    // No legacy sign dropdown/image elements in simplified flow
        
        // Zoom control elements
        this.zoomInBtn = document.getElementById('zoom-in-btn');
        this.zoomOutBtn = document.getElementById('zoom-out-btn');
        this.zoomFitBtn = document.getElementById('zoom-fit-btn');
        this.zoomLevel = document.getElementById('zoom-level');
        
        // Signature style controls
        this.fontFamilySelect = document.getElementById('font-family-select');
        this.fontSizeInput = document.getElementById('font-size-input');
        this.fontColorInput = document.getElementById('font-color-input');

        // Toolbar elements
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn');

    // Text-only flow state
    this.selectedFontSize = 20;
        
        // Other elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingMessage = document.getElementById('loading-message');
        this.toastContainer = document.getElementById('toast-container');
    // Page navigation controls inside modal (header nav removed)
    this.prevPageBtn = null;
    this.nextPageBtn = null;
        // bottom nav buttons (large red arrows)
        this.sidePrevBtn = document.getElementById('side-prev-btn');
        this.sideNextBtn = document.getElementById('side-next-btn');
    }

    setupEventListeners() {
        // File upload events
        if (this.dropArea) this.dropArea.addEventListener('click', () => this.fileInput.click());
        if (this.browseBtn) this.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.fileInput) this.fileInput.click();
        });
        if (this.fileInput) this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop events
        if (this.dropArea) {
            this.dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.dropArea.addEventListener('drop', (e) => this.handleDrop(e));
        }
        
        // Button events
        if (this.prepareBtn) this.prepareBtn.addEventListener('click', () => this.prepareDocument());
        // Removed signer and fields buttons as they no longer exist in simplified flow
        if (this.sendBtn) this.sendBtn.addEventListener('click', () => this.sendForSignature());
        
        // Modal events
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.completeSetupBtn) {
            // When used inside modal, treat as Save: process and download the stamped PDF
            this.completeSetupBtn.addEventListener('click', () => {
                // If modal is visible, process and download; otherwise run original complete flow
                if (this.modal && this.modal.style.display !== 'none') {
                    this.processAndDownload();
                } else {
                    this.completeSetup();
                }
            });
        }
        
        // Deselection logic when clicking on the background of the pages container
        if (this.documentPagesContainer) {
            this.documentPagesContainer.addEventListener('click', (e) => {
                // If click is on the container, wrapper, or canvas, but not on a signature field
                if (e.target === this.documentPagesContainer || e.target.classList.contains('pdf-page-wrapper') || e.target.classList.contains('pdf-page-canvas')) {
                    if (this.selectedField) {
                        const oldElement = document.querySelector(`.signature-text-only.selected`);
                        if (oldElement) {
                            oldElement.classList.remove('selected');
                        }
                        this.selectedField = null;
                    }
                }
            });
        }
        
    // No toolbar or sign dropdown/image events in simplified flow
        
        // Zoom control events
    // Zoom interactions removed for fixed scale
    // header nav buttons removed; only side buttons remain
        if (this.sidePrevBtn) this.sidePrevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prevPage(); });
        if (this.sideNextBtn) this.sideNextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.nextPage(); });
        
        // Signature style control events - use guarded handlers to avoid re-applying defaults during programmatic updates
        if (this.fontFamilySelect) this.fontFamilySelect.addEventListener('change', (e) => {
            if (this.suppressStyleUpdates) return;
            this.updateSelectedFieldStyle();
        });
        if (this.fontSizeInput) this.fontSizeInput.addEventListener('input', (e) => {
            if (this.suppressStyleUpdates) return;
            this.updateSelectedFieldStyle();
        });
        if (this.fontColorInput) this.fontColorInput.addEventListener('input', (e) => {
            if (this.suppressStyleUpdates) return;
            this.updateSelectedFieldStyle();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.closeModal();
            }
            // Keyboard left/right to navigate pages in modal
            if (e.key === 'ArrowLeft' && this.modal && this.modal.style.display !== 'none') {
                e.preventDefault();
                this.pageDirection = 'from-left';
                this.prevPage();
            }
            if (e.key === 'ArrowRight' && this.modal && this.modal.style.display !== 'none') {
                e.preventDefault();
                this.pageDirection = 'from-right';
                this.nextPage();
            }
            // Disable keyboard zoom shortcuts
        });
        
        // Signer input events
        if (this.signerEmail) {
            this.signerEmail.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSigner();
                }
            });
        }

        if (this.signerName) {
            this.signerName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSigner();
                }
            });
        }
    }    goToPage(pageNum) {
        if (!this.pdfDocument) return;
        const numPages = this.pdfDocument.numPages;
        if (pageNum < 1) pageNum = 1;
        if (pageNum > numPages) pageNum = numPages;
        this.currentPage = pageNum;
        // Re-render current page
        this.renderAllPages();
    }

    nextPage() {
        if (!this.pdfDocument) return;
        const numPages = this.pdfDocument.numPages;
        if (this.currentPage < numPages) {
            // animate as entering from right
            if (!this.pageDirection) this.pageDirection = 'from-right';
            this.currentPage += 1;
            this.renderAllPages();
        }
    }

    prevPage() {
        if (!this.pdfDocument) return;
        if (this.currentPage > 1) {
            // animate as entering from left
            if (!this.pageDirection) this.pageDirection = 'from-left';
            this.currentPage -= 1;
            this.renderAllPages();
        }
    }

    // File handling methods
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.dropArea.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.dropArea.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        this.dropArea.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    async processFile(file) {
        // Validate file type
        if (file.type !== 'application/pdf') {
            this.showToast('Please select a PDF file only.', 'error');
            return;
        }

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        if (file.size > maxSize) {
            this.showToast('File size must be less than 50MB.', 'error');
            return;
        }

        this.showLoading('Processing document...');
        
        try {
            this.uploadedFile = file;
            this.fileInfo.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            this.prepareBtn.disabled = false;
            
            // Load PDF for preview
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            this.hideLoading();
            this.showToast('Document uploaded successfully!', 'success');
        } catch (error) {
            console.error('Error processing file:', error);
            this.hideLoading();
            this.showToast('Error processing document. Please try again.', 'error');
        }
    }

    prepareDocument() {
        if (!this.uploadedFile) {
            this.showToast('Please upload a document first.', 'error');
            return;
        }
        // Open the document preview modal immediately so user can place signatures
        this.prepareBtn.textContent = 'Document Prepared';
        this.prepareBtn.disabled = true;

        // Ensure PDF.js document is loaded (already loaded during file selection)
        this.openDocumentPreview();
    }

    // Signer management methods
    addSigner() {
        const name = (this.signerName && this.signerName.value) ? this.signerName.value.trim() : '';
        // Email input was removed from the UI; accept empty email but still allow signer creation
        const email = (this.signerEmail && this.signerEmail.value) ? this.signerEmail.value.trim() : '';

        if (!name) {
            this.showToast('Please enter the signer name.', 'error');
            return;
        }

        if (email && !this.isValidEmail(email)) {
            this.showToast('Please enter a valid email address.', 'error');
            return;
        }

        // Check for duplicate names if no email provided
        if (email) {
            if (this.signers.some(signer => signer.email === email)) {
                this.showToast('This email is already added.', 'error');
                return;
            }
        } else {
            if (this.signers.some(signer => signer.name === name)) {
                this.showToast('This signer is already added.', 'error');
                return;
            }
        }

        const signer = {
            id: Date.now(),
            name: name,
            email: email
        };
        
        this.signers.push(signer);
        this.renderSignersList();
        this.updateSignerSelect();
        
        // Clear inputs
        this.signerName.value = '';
        this.signerEmail.value = '';
        
        this.showToast(`${name} added as signer.`, 'success');
    }

    removeSigner(signerId) {
        this.signers = this.signers.filter(signer => signer.id !== signerId);
        this.renderSignersList();
        this.updateSignerSelect();
        
        // Remove signature fields assigned to this signer
        this.signatureFields = this.signatureFields.filter(field => field.signerId !== signerId);
        
        this.showToast('Signer removed.', 'success');
    }

    renderSignersList() {
        // Guard against missing signers list element (removed in simplified flow)
        if (!this.signersList) return;
        
        if (this.signers.length === 0) {
            this.signersList.innerHTML = '<p style="color: var(--muted); text-align: center; margin: 1rem 0;">No signers added yet.</p>';
            return;
        }
        this.signersList.innerHTML = this.signers.map(signer => `
            <div class="signer-item">
                <div class="signer-info">
                    <div class="signer-name">${this.escapeHtml(signer.name)}</div>
                    ${signer.email ? `<div class="signer-email">${this.escapeHtml(signer.email)}</div>` : ''}
                </div>
                <button class="remove-signer" onclick="eSignProcessor.removeSigner(${signer.id})">
                    Remove
                </button>
            </div>
        `).join('');
    }

    updateSignerSelect() {
        if (!this.fieldSignerSelect) return;

        const options = this.signers.map(signer => 
            `<option value="${signer.id}">${this.escapeHtml(signer.name)}</option>`
        ).join('');

        this.fieldSignerSelect.innerHTML = '<option value="">Select signer...</option>' + options;
    }

    // Document preview and signature field methods
    async openDocumentPreview() {
        // Allow opening preview regardless of signers — placement can be anonymous
        if (!this.pdfDocument) {
            this.showToast('Document not loaded. Please try uploading again.', 'error');
            return;
        }
        
        this.showLoading('Loading document preview...');
        
        try {
            await this.renderAllPages();
            
            // Try to restore previous signature field data
            this.restoreSignatureFieldData();
            
            this.modal.style.display = 'flex';
            this.hideLoading();
        } catch (error) {
            console.error('Error opening document preview:', error);
            this.hideLoading();
            this.showToast('Error loading document preview.', 'error');
        }
    }

    restoreSignatureFieldData() {
        try {
            const savedData = sessionStorage.getItem('esignFieldData');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // Check if this is the same document
                if (data.documentInfo?.name === this.uploadedFile?.name && 
                    data.documentInfo?.pages === this.pdfDocument?.numPages) {
                    
                    // Restore all stored fields (anonymous placement supported)
                    const validFields = Array.isArray(data.fields) ? data.fields : [];
                    if (validFields.length > 0) {
                        this.signatureFields = validFields;
                        this.renderSignatureFields();
                        this.showToast(`Restored ${validFields.length} signature fields`, 'info');
                    }
                }
            }
        } catch (error) {
            console.warn('Could not restore signature field data:', error);
        }
    }

    async renderAllPages() {
        // Render only the current page inside the modal so user sees one page at a time
        if (!this.pdfDocument) return;

    this.documentPagesContainer.innerHTML = '';
        const numPages = this.pdfDocument.numPages;
        // ensure currentPage is within bounds
        if (!this.currentPage || this.currentPage < 1) this.currentPage = 1;
        if (this.currentPage > numPages) this.currentPage = numPages;

        const pageNum = this.currentPage;
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'pdf-page-wrapper single-page';
        pageWrapper.dataset.pageNumber = pageNum;

        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${pageNum} of ${numPages}`;

    // Create a frame container around the page content (canvas + overlay)
    const frame = document.createElement('div');
    frame.className = 'page-frame';
    frame.style.position = 'relative';
    frame.style.display = 'inline-block';
    frame.style.background = '#fff';
    frame.style.border = '2px solid #d0d7de';
    frame.style.borderRadius = '8px';
    frame.style.boxSizing = 'content-box';

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.dataset.pageNumber = pageNum;

    const overlay = document.createElement('div');
    overlay.className = 'page-signature-overlay';
    overlay.dataset.pageNumber = pageNum;

    pageWrapper.appendChild(pageNumber);
    frame.appendChild(canvas);
    frame.appendChild(overlay);
    pageWrapper.appendChild(frame);
    this.documentPagesContainer.appendChild(pageWrapper);

    // Render the PDF page, but first compute fit-to-container scale
        const page = await this.pdfDocument.getPage(pageNum);

        // Get native page size using scale = 1 viewport
        const unscaledViewport = page.getViewport({ scale: 1 });

        // Compute available container size (subtract minor padding if present)
        const containerRect = this.documentPagesContainer.getBoundingClientRect();
        let availW = containerRect.width || 800; // fallback
        let availH = containerRect.height || 600; // fallback

    // We keep the page-number label inside the wrapper (top-left), so no height subtraction is needed

    // Compute fit scale to fit page inside available area (fixed scale)
        const scaleX = availW / unscaledViewport.width;
        const scaleY = availH / unscaledViewport.height;
        const fitScale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY) * 0.98));

        // Apply computed scale
        this.scale = fitScale || this.scale;

        const viewport = page.getViewport({ scale: this.scale });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    // set overlay dimensions to follow the visible canvas size (CSS)
    overlay.style.position = 'absolute';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

        const ctx = canvas.getContext('2d');
        const renderContext = { canvasContext: ctx, viewport };

        // Cancel any in-flight render and render fresh at this.scale
        try { if (this.currentRenderTask && this.currentRenderTask.cancel) this.currentRenderTask.cancel(); } catch (_) {}
        this.isRendering = true;
        let renderError = null;
        try {
            this.currentRenderTask = page.render(renderContext);
            await this.currentRenderTask.promise;
        } catch (err) {
            // Ignore cancellation errors; report others
            if (!/Rendering cancelled|Task was cancelled/i.test(String(err))) {
                console.warn('PDF render error:', err);
                renderError = err;
            }
        } finally {
            this.isRendering = false;
            this.currentRenderTask = null;
        }
        if (renderError) throw renderError;

    // Apply enter animation if pageDirection is set
        if (this.pageDirection) {
            pageWrapper.classList.add('page-enter', this.pageDirection);
            // Remove animation classes after animation completes
            pageWrapper.addEventListener('animationend', () => {
                pageWrapper.classList.remove('page-enter', 'from-right', 'from-left');
            }, { once: true });
            // reset direction
            this.pageDirection = null;
        }

        // Position side nav buttons (if present) immediately next to the canvas edges
        try {
            // Move side nav buttons into the frame and align to its left/right edges
            const prevBtn = this.sidePrevBtn || document.getElementById('side-prev-btn');
            const nextBtn = this.sideNextBtn || document.getElementById('side-next-btn');
            if (prevBtn && prevBtn.parentNode !== frame) frame.appendChild(prevBtn);
            if (nextBtn && nextBtn.parentNode !== frame) frame.appendChild(nextBtn);
            if (prevBtn) {
                prevBtn.style.position = 'absolute';
                prevBtn.style.left = '8px';
                prevBtn.style.top = '50%';
                prevBtn.style.transform = 'translateY(-50%)';
                prevBtn.style.display = 'inline-flex';
                prevBtn.style.zIndex = '1200';
            }
            if (nextBtn) {
                nextBtn.style.position = 'absolute';
                nextBtn.style.right = '8px';
                nextBtn.style.top = '50%';
                nextBtn.style.transform = 'translateY(-50%)';
                nextBtn.style.display = 'inline-flex';
                nextBtn.style.zIndex = '1200';
            }
        } catch (err) {
            // ignore positioning errors
            console.warn('Could not position side nav buttons:', err);
        }

    // Attach click handler to place signatures on this single page
        canvas.addEventListener('click', (event) => {
            this.addSignatureField(event, pageNum, canvas, overlay);
        });

    // Re-render signature fields that belong to this page
    // ensure overlay is attached before rendering fields
    setTimeout(() => this.renderSignatureFields(), 0);
    }

    selectFieldType(fieldType) {
        this.currentFieldType = fieldType;
        this.toolbarBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.fieldType === fieldType);
        });
    }

    addSignatureField(event, pageNumber, canvas, overlay) {
        // When clicking to add a new field, deselect any active one.
        if (this.selectedField) {
            const oldElement = document.querySelector(`.signature-text-only.selected`);
            if (oldElement) {
                oldElement.classList.remove('selected');
            }
            this.selectedField = null;
        }

        // No longer require signer selection - place signatures anonymously
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
    overlay.style.pointerEvents = 'auto';

        // Create an editable, resizable textarea so user can edit text and resize to change size
        const textarea = document.createElement('textarea');
        textarea.className = 'signature-textarea';
        textarea.value = this.selectedSignText || '';
        textarea.style.position = 'absolute';
        textarea.style.left = x + 'px';
        textarea.style.top = y + 'px';
        textarea.style.width = '180px';
        textarea.style.height = '48px';
        // Apply current styles from controls
        textarea.style.fontFamily = this.fontFamilySelect ? this.fontFamilySelect.value : 'Arial';
        textarea.style.fontSize = this.fontSizeInput ? this.fontSizeInput.value + 'px' : '20px';
        textarea.style.color = this.fontColorInput ? this.fontColorInput.value : '#000000';
        textarea.style.resize = 'both';
        textarea.style.padding = '6px 8px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.zIndex = '2000';
        textarea.setAttribute('placeholder', 'Type signature text and press Enter to place');
        overlay.appendChild(textarea);
        textarea.focus();

        // --- FIX STARTS HERE ---
        // Create a canonical style object that will be the single source-of-truth for this textarea
        const canonicalStyle = {
            fontFamily: this.fontFamilySelect ? this.fontFamilySelect.value : 'Arial',
            fontSize: this.fontSizeInput ? parseInt(this.fontSizeInput.value, 10) : 20,
            color: this.fontColorInput ? this.fontColorInput.value : '#000000'
        };

    // Apply canonical styles to the textarea initially
    textarea.style.fontFamily = canonicalStyle.fontFamily;
    textarea.style.fontSize = canonicalStyle.fontSize + 'px';
    textarea.style.color = canonicalStyle.color;
    console.log('[eSign] textarea created at', { page: pageNumber, x, y, canonicalStyle });

        // Handlers that update the canonical style and reflect it into textarea
        const onFontFamilyChange = (e) => {
            canonicalStyle.fontFamily = this.fontFamilySelect.value;
            textarea.style.fontFamily = canonicalStyle.fontFamily;
            console.log('[eSign] font family changed (textarea)', canonicalStyle.fontFamily);
        };
        const onFontSizeChange = (e) => {
            canonicalStyle.fontSize = parseInt(this.fontSizeInput.value, 10);
            textarea.style.fontSize = canonicalStyle.fontSize + 'px';
            console.log('[eSign] font size changed (textarea)', canonicalStyle.fontSize);
        };
        const onFontColorChange = (e) => {
            canonicalStyle.color = this.fontColorInput.value;
            textarea.style.color = canonicalStyle.color;
            console.log('[eSign] font color changed (textarea)', canonicalStyle.color);
        };

        // Attach listeners to the controls to update the canonical style live.
        this.fontFamilySelect.addEventListener('change', onFontFamilyChange);
        this.fontSizeInput.addEventListener('input', onFontSizeChange);
        this.fontColorInput.addEventListener('input', onFontColorChange);

    const cleanupListeners = () => {
            this.fontFamilySelect.removeEventListener('change', onFontFamilyChange);
            this.fontSizeInput.removeEventListener('input', onFontSizeChange);
            this.fontColorInput.removeEventListener('input', onFontColorChange);
        };
        // --- FIX ENDS HERE ---

        // Allow dragging of the textarea
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

    textarea.addEventListener('mousedown', (e) => {
            // If mousedown occurs on the resize handle, skip dragging (browser handles resize)
            // Detect if near the bottom-right corner within 14px
            const bounds = textarea.getBoundingClientRect();
            if (e.clientX > bounds.right - 18 && e.clientY > bounds.bottom - 18) {
                return; // allow resize
            }
            isDragging = true;
            dragOffsetX = e.clientX - bounds.left;
            dragOffsetY = e.clientY - bounds.top;
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = canvas.getBoundingClientRect();
            let newLeft = e.clientX - containerRect.left - dragOffsetX;
            let newTop = e.clientY - containerRect.top - dragOffsetY;
            // constrain inside canvas
            newLeft = Math.max(0, Math.min(containerRect.width - textarea.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(containerRect.height - textarea.offsetHeight, newTop));
            textarea.style.left = newLeft + 'px';
            textarea.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });

        // Update font size as user resizes the box (on mouseup and input)
        const updateFontSizeFromBox = () => {
            const h = textarea.clientHeight;
            // map box height to font size (approx)
            const fontSize = Math.max(10, Math.round(h * 0.35));
            textarea.style.fontSize = fontSize + 'px';
        };

        textarea.addEventListener('input', () => {
            updateFontSizeFromBox();
        });
        textarea.addEventListener('mouseup', () => {
            updateFontSizeFromBox();
        });

        // --- FIX: Centralize placement logic to be reusable ---
        let isFinalizing = false;
        const finalizePlacement = () => {
            if (isFinalizing) return;
            isFinalizing = true;

            // First, remove the temporary listeners to prevent leaks.
            cleanupListeners();

            const finalText = textarea.value.trim();
            if (!finalText) {
                // if empty, just remove
                if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
                overlay.style.pointerEvents = 'none';
                return;
            }

            // Create the field object and save
            const rectNow = canvas.getBoundingClientRect();
            const left = parseFloat(textarea.style.left);
            const top = parseFloat(textarea.style.top);
            const w = textarea.offsetWidth;
            const h = textarea.offsetHeight;

            console.log('[eSign] Finalizing placement', { finalText, canonicalStyle });
            const field = {
                id: Date.now(),
                type: 'signature',
                signerId: 1,
                signText: finalText,
                page: pageNumber,
                x: left,
                y: top,
                width: w,
                height: h,
                // Use on-screen size (CSS pixels) for relative values so drag math matches visuals
                relativeX: left / rectNow.width,
                relativeY: top / rectNow.height,
                relativeWidth: Math.min(1, w / (rectNow.width || 1)),
                relativeHeight: Math.min(1, h / (rectNow.height || 1)),
                // Pull style values from canonicalStyle to ensure consistency
                fontFamily: canonicalStyle.fontFamily,
                color: canonicalStyle.color,
                fontSize: canonicalStyle.fontSize
            };

            this.signatureFields.push(field);
            if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
            overlay.style.pointerEvents = 'none';
            this.renderSignatureFields();
            this.showToast(`Signature placed on page ${pageNumber}`, 'success');
            
            // Ensure no signature is selected after placement
            this.selectedField = null;
            document.querySelectorAll('.signature-text-only.selected').forEach(el => el.classList.remove('selected'));
        };

        // Finalize on Enter key
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finalizePlacement();
            }
        });

        // Finalize when clicking outside the textarea
        textarea.addEventListener('blur', finalizePlacement);
    }

    renderSignatureFields() {
        // Clear all existing signature fields from all page overlays
        document.querySelectorAll('.page-signature-overlay').forEach(overlay => {
            overlay.innerHTML = '';
        });
        // Defensive cleanup: remove any legacy boxed templates if present
        document.querySelectorAll('.signature-field').forEach(el => el.remove());
        
    this.signatureFields.forEach(field => {
            const overlay = document.querySelector(`.page-signature-overlay[data-page-number="${field.page}"]`);
            const canvas = document.querySelector(`.pdf-page-canvas[data-page-number="${field.page}"]`);
            if (!overlay || !canvas) return;

            // Calculate absolute position from relative coordinates using on-screen size
            const rect = canvas.getBoundingClientRect();
            const x = field.relativeX * rect.width;
            const y = field.relativeY * rect.height;
            const width = field.relativeWidth * rect.width;
            const height = field.relativeHeight * rect.height;

            // Render completely plain text only (no container, no styling) at the saved position
            const textElement = document.createElement('span');
            textElement.className = 'signature-text-only';
            textElement.dataset.fieldType = field.type;
            textElement.dataset.fieldId = field.id;
            
            // Apply only essential positioning and text styling
            textElement.style.position = 'absolute';
            textElement.style.left = x + 'px';
            textElement.style.top = y + 'px';
            textElement.style.background = 'none';
            textElement.style.border = 'none';
            textElement.style.padding = '0';
            textElement.style.margin = '0';
            textElement.style.boxShadow = 'none';
            textElement.style.outline = 'none';
            textElement.style.pointerEvents = 'auto';
            textElement.style.userSelect = 'none';
            textElement.style.whiteSpace = 'nowrap';
            
            // Apply stored styles
            textElement.style.color = field.color || '#000000';
            textElement.style.fontFamily = field.fontFamily || 'Arial';
            textElement.style.fontSize = (field.fontSize || Math.max(10, Math.round(height * 0.35))) + 'px';
            textElement.textContent = field.signText || 'SIGNATURE';

            // Allow clicking to select (keeps existing selection behavior)
            textElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectField(field, textElement);
            });

            // Still allow dragging the plain text element to reposition
            this.makeFieldDraggable(textElement, field, overlay, canvas);

            overlay.appendChild(textElement);

            // After mounting, measure actual size and update relative width/height
            const elRect = textElement.getBoundingClientRect();
            const canvasRect2 = canvas.getBoundingClientRect();
            const relW = Math.min(1, (elRect.width || 1) / (canvasRect2.width || 1));
            const relH = Math.min(1, (elRect.height || 1) / (canvasRect2.height || 1));
            field.relativeWidth = relW;
            field.relativeHeight = relH;

            // Clamp position in case width changed significantly from initial textarea width
            const maxRelX = Math.max(0, 1 - field.relativeWidth);
            const maxRelY = Math.max(0, 1 - field.relativeHeight);
            if (field.relativeX > maxRelX) field.relativeX = maxRelX;
            if (field.relativeY > maxRelY) field.relativeY = maxRelY;
            // Apply clamped positions
            textElement.style.left = (field.relativeX * canvasRect2.width) + 'px';
            textElement.style.top = (field.relativeY * canvasRect2.height) + 'px';
        });
    }

    selectField(field, element) {
        this.selectedField = field;
        document.querySelectorAll('.signature-text-only').forEach(el => el.classList.remove('selected'));
        if (element) {
            element.classList.add('selected');
            // Update controls to reflect selected field's style. Suppress change handlers while updating controls.
            this.suppressStyleUpdates = true;
            try {
                if (this.fontFamilySelect) this.fontFamilySelect.value = field.fontFamily || 'Arial';
                if (this.fontSizeInput) this.fontSizeInput.value = field.fontSize || 20;
                if (this.fontColorInput) this.fontColorInput.value = field.color || '#000000';
                console.log('[eSign] selectField set controls to', { fontFamily: this.fontFamilySelect.value, fontSize: this.fontSizeInput.value, color: this.fontColorInput.value });
            } finally {
                // Allow updates again after a short defer to ensure no immediate event triggers fire
                setTimeout(() => { this.suppressStyleUpdates = false; }, 0);
            }
        }
    }

    removeSignatureField(fieldId) {
        this.signatureFields = this.signatureFields.filter(field => field.id !== fieldId);
        this.renderSignatureFields();
        this.showToast('Signature field removed.', 'success');
    }

    completeSetup() {
        if (this.signatureFields.length === 0) {
            this.showToast('Please add at least one signature field.', 'error');
            return;
        }
        
        // Store signature field data for preservation
        this.preserveSignatureFieldData();
        
        this.closeModal();
        if (this.sendSection) {
            this.sendSection.style.display = 'block';
            this.updateSendSummary();
            this.sendSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    preserveSignatureFieldData() {
        // Create a data object with all signature field information
        const signatureData = {
            fields: this.signatureFields.map(field => ({
                id: field.id,
                type: field.type,
                signerId: field.signerId,
                signerName: this.signers.find(s => s.id === field.signerId)?.name,
                page: field.page,
                signText: field.signText,
                relativeX: field.relativeX,
                relativeY: field.relativeY,
                relativeWidth: field.relativeWidth,
                relativeHeight: field.relativeHeight,
                // Also preserve style info
                fontFamily: field.fontFamily,
                fontSize: field.fontSize,
                color: field.color
            })),
            signers: this.signers,
            documentInfo: {
                name: this.uploadedFile?.name,
                pages: this.pdfDocument?.numPages
            }
        };
        
        // Store in session storage for immediate use
        sessionStorage.setItem('esignFieldData', JSON.stringify(signatureData));
        
        // Also store as downloadable JSON for backup
        this.downloadSignatureData(signatureData);
    }

    downloadSignatureData(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.uploadedFile?.name || 'document'}_signature_fields.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Signature field data saved for backup', 'success');
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.selectedField = null;
    }

    // Send for signature methods
    updateSendSummary() {
        const summaryHtml = `
            <div class="summary-item">
                <span class="summary-label">Document:</span>
                <span class="summary-value">${this.uploadedFile.name}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Signers:</span>
                <span class="summary-value">${this.signers.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Signature Fields:</span>
                <span class="summary-value">${this.signatureFields.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">File Size:</span>
                <span class="summary-value">${this.formatFileSize(this.uploadedFile.size)}</span>
            </div>
        `;
        
        this.sendSummary.innerHTML = summaryHtml;
    }

    sendForSignature() {
        if (this.signers.length === 0) {
            this.showToast('Please add at least one signer.', 'error');
            return;
        }
        
        if (this.signatureFields.length === 0) {
            this.showToast('Please add signature fields to the document.', 'error');
            return;
        }
        
        this.showLoading('Sending document for signature...');
        
        // Simulate API call
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Document sent for signature successfully!', 'success');
            
            // Reset the form
            this.resetForm();
        }, 2000);
    }

    // Process the original PDF, stamp signature placeholders, and trigger download
    async processAndDownload() {
        if (!this.uploadedFile || !this.pdfDocument) {
            this.showToast('No document loaded to process.', 'error');
            return;
        }

        // Debug logging
        console.log('Processing signatures:', this.signatureFields.length, 'fields');
        this.signatureFields.forEach((field, index) => {
            console.log(`Field ${index}:`, {
                page: field.page,
                signText: field.signText,
                relativeX: field.relativeX,
                relativeY: field.relativeY,
                relativeWidth: field.relativeWidth,
                relativeHeight: field.relativeHeight
            });
        });

        this.showLoading('Applying signatures to document...');

        try {
            // Load pdf-lib dynamically
            const pdfLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.js');
            const arrayBuffer = await this.uploadedFile.arrayBuffer();
            const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer);

            // Embed custom fonts
            const fontCache = {};
            const fontUrls = {
                "'Dancing Script', cursive": 'https://fonts.gstatic.com/s/dancingscript/v24/If2RXTr6YS-zF4S-kcSWSVi_szLviuEViw.ttf',
                "'Great Vibes', cursive": 'https://fonts.gstatic.com/s/greatvibes/v14/RWmMoKWR9v4ksMvYJwAbe8c.ttf',
                "'Pacifico', cursive": 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6Mk.ttf',
                "'Cedarville Cursive', cursive": 'https://fonts.gstatic.com/s/cedarvillecursive/v19/yYLr0hG387S_S94DPjY_v2-s-3wA4w.ttf',
                "'Allura', cursive": 'https://fonts.gstatic.com/s/allura/v16/9oRPNYsQpS4zjuAPjA.ttf'
            };

            async function getFont(fontFamily) {
                if (fontCache[fontFamily]) return fontCache[fontFamily];
                if (fontUrls[fontFamily]) {
                    try {
                        const fontBytes = await fetch(fontUrls[fontFamily]).then(res => res.arrayBuffer());
                        const customFont = await pdfDoc.embedFont(fontBytes);
                        fontCache[fontFamily] = customFont;
                        return customFont;
                    } catch (e) {
                        console.warn(`Failed to load custom font ${fontFamily}. Falling back to Helvetica.`, e);
                    }
                }
                return pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
            }

            // For each signature field, draw signature text only on the respective page
            for (const field of this.signatureFields) {
                const pageIndex = field.page - 1;
                if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;
                const page = pdfDoc.getPages()[pageIndex];

                // Determine page size and convert relative coords to PDF points
                const { width: pageWidth, height: pageHeight } = page.getSize();

                const x = field.relativeX * pageWidth;
                // PDF coordinate origin is bottom-left
                const y = pageHeight - (field.relativeY * pageHeight) - (field.relativeHeight * pageHeight);
                const w = field.relativeWidth * pageWidth;
                const h = field.relativeHeight * pageHeight;

                // Draw signature text only (no rectangle/background)
                const labelText = field.signText || 'SIGNATURE';
                const font = await getFont(field.fontFamily);
                const colorRgb = field.color ? pdfLib.rgb(
                    parseInt(field.color.slice(1, 3), 16) / 255,
                    parseInt(field.color.slice(3, 5), 16) / 255,
                    parseInt(field.color.slice(5, 7), 16) / 255
                ) : pdfLib.rgb(0, 0, 0);

                // Choose font size based on stored field height (use a reasonable scale)
                const fontSize = field.fontSize || Math.max(10, Math.round(h * 0.6));

                // Left-align the text at the saved x; vertically center within the height
                const textX = x + 2; // small padding
                const textY = y + Math.max(0, Math.round((h - fontSize) / 2));

                page.drawText(labelText, {
                    x: textX,
                    y: textY,
                    size: fontSize,
                    font: font,
                    color: colorRgb
                });
            }

            const modifiedBytes = await pdfDoc.save();

            // Trigger download
            const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.uploadedFile.name.replace(/\.[^.]+$/, '')}_signed.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.hideLoading();
            this.showToast('Signed PDF ready for download', 'success');
        } catch (error) {
            console.error('Error stamping PDF:', error);
            this.hideLoading();
            this.showToast('Failed to process the PDF. See console for details.', 'error');
        }
    }

    resetForm() {
        this.uploadedFile = null;
        this.signers = [];
        this.signatureFields = [];
        this.pdfDocument = null;
        
        if (this.fileInfo) this.fileInfo.textContent = 'No document selected';
        if (this.prepareBtn) {
            this.prepareBtn.disabled = true;
            this.prepareBtn.textContent = 'Prepare for Signing';
        }
        
        // Clear any form inputs that might exist
        if (this.signerName) this.signerName.value = '';
        if (this.signerEmail) this.signerEmail.value = '';
        if (this.signatureMessage) this.signatureMessage.value = '';
        if (this.fileInput) this.fileInput.value = '';
    }

    // Utility methods
    showLoading(message) {
        this.loadingMessage.textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    // Structured logger for debugging — stores logs in memory and prints to console
    log(action, details = {}) {
        try {
            const entry = { ts: new Date().toISOString(), action, details };
            this.actionLogs = this.actionLogs || [];
            this.actionLogs.push(entry);
            // concise console output for developer visibility
            console.log('[eSign log]', entry);
        } catch (e) {
            // safe noop
            console.warn('eSign logging failed', e);
        }
    }
    makeFieldDraggable(fieldElement, field, overlay, canvas) {
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        fieldElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            const fieldRect = fieldElement.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            // Calculate offset relative to the field element
            dragOffsetX = e.clientX - fieldRect.left;
            dragOffsetY = e.clientY - fieldRect.top;
            
            fieldElement.style.cursor = 'grabbing';
            fieldElement.style.zIndex = '1000';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const canvasRect = canvas.getBoundingClientRect();

            // Calculate new position relative to canvas (on-screen pixels)
            let newX = e.clientX - canvasRect.left - dragOffsetX;
            let newY = e.clientY - canvasRect.top - dragOffsetY;

            // Convert to relative coordinates using on-screen width/height
            const newRelativeX = newX / canvasRect.width;
            const newRelativeY = newY / canvasRect.height;

            // Constrain to canvas bounds using up-to-date dimensions
            const maxRelX = Math.max(0, 1 - (field.relativeWidth || 0));
            const maxRelY = Math.max(0, 1 - (field.relativeHeight || 0));
            const constrainedX = Math.max(0, Math.min(maxRelX, newRelativeX));
            const constrainedY = Math.max(0, Math.min(maxRelY, newRelativeY));

            field.relativeX = constrainedX;
            field.relativeY = constrainedY;

            // Update visual position with constrained values using on-screen size
            const finalX = constrainedX * canvasRect.width;
            const finalY = constrainedY * canvasRect.height;

            fieldElement.style.left = finalX + 'px';
            fieldElement.style.top = finalY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                fieldElement.style.cursor = 'move';
                fieldElement.style.zIndex = '10';
            }
        });
    }

    updateSelectedFieldStyle() {
        if (!this.selectedField) return;

        const newFontFamily = this.fontFamilySelect.value;
        const newFontSize = parseInt(this.fontSizeInput.value, 10);
        const newColor = this.fontColorInput.value;

        // Find the field in the main array and update it
        const fieldToUpdate = this.signatureFields.find(f => f.id === this.selectedField.id);
        if (fieldToUpdate) {
            fieldToUpdate.fontFamily = newFontFamily;
            fieldToUpdate.fontSize = newFontSize;
            fieldToUpdate.color = newColor;

            console.log('[eSign] updateSelectedFieldStyle applied', { id: fieldToUpdate.id, fontFamily: newFontFamily, fontSize: newFontSize, color: newColor });

            // Update the DOM element directly for immediate feedback
            const element = document.querySelector(`.signature-text-only[data-field-id="${fieldToUpdate.id}"]`);
            if (element) {
                element.style.fontFamily = newFontFamily;
                element.style.fontSize = newFontSize + 'px';
                element.style.color = newColor;

                // Recalculate size and clamp position after style change
                const canvas = document.querySelector(`.pdf-page-canvas[data-page-number="${fieldToUpdate.page}"]`);
                if (canvas) {
                    const elRect = element.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    fieldToUpdate.relativeWidth = Math.min(1, (elRect.width || 1) / (canvasRect.width || 1));
                    fieldToUpdate.relativeHeight = Math.min(1, (elRect.height || 1) / (canvasRect.height || 1));
                    const maxRelX = Math.max(0, 1 - fieldToUpdate.relativeWidth);
                    const maxRelY = Math.max(0, 1 - fieldToUpdate.relativeHeight);
                    if (fieldToUpdate.relativeX > maxRelX) fieldToUpdate.relativeX = maxRelX;
                    if (fieldToUpdate.relativeY > maxRelY) fieldToUpdate.relativeY = maxRelY;
                    // Apply clamped pixel positions
                    element.style.left = (fieldToUpdate.relativeX * canvasRect.width) + 'px';
                    element.style.top = (fieldToUpdate.relativeY * canvasRect.height) + 'px';
                }
            }
        }
    }

    // Zoom removed: rendering always uses fit-to-container scale when rendering pages
}

// Initialize the eSign processor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.eSignProcessor = new ESignProcessor();
});
