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
    this.pageDirection = null; // 'from-right' or 'from-left' for animation
        
        this.initializeElements();
        this.setupEventListeners();
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
    this.fieldSignerSelect = document.getElementById('field-signer-select');
        this.completeSetupBtn = document.getElementById('complete-setup-btn');
    // Sign tool elements
    this.signDropdown = document.getElementById('sign-dropdown');
    this.currentSignValue = document.getElementById('current-sign-value');
    this.signToggleBtn = document.getElementById('add-signature-field');
        
        // Zoom control elements
        this.zoomInBtn = document.getElementById('zoom-in-btn');
        this.zoomOutBtn = document.getElementById('zoom-out-btn');
        this.zoomFitBtn = document.getElementById('zoom-fit-btn');
        this.zoomLevel = document.getElementById('zoom-level');
        
        // Toolbar elements
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn');

    // Internal state for selected sign text
    this.selectedSignIndex = null;
    this.selectedSignText = null;
        
        // Other elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingMessage = document.getElementById('loading-message');
        this.toastContainer = document.getElementById('toast-container');
    // Page navigation controls inside modal
    this.prevPageBtn = document.getElementById('prev-page-btn');
    this.nextPageBtn = document.getElementById('next-page-btn');
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
        
        // Toolbar events
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectFieldType(btn.dataset.fieldType));
        });

        // Sign dropdown toggle and choose handlers
        if (this.signToggleBtn) {
            this.signToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.signDropdown) return;
                this.signDropdown.style.display = this.signDropdown.style.display === 'none' ? 'block' : 'none';
            });
        }

        // Delegate choose sign buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.choose-sign-btn');
            if (btn) {
                const idx = btn.dataset.index;
                const input = document.getElementById('sign-input-' + idx);
                if (input) {
                    this.selectedSignIndex = idx;
                    this.selectedSignText = input.value || (`SIGN-${idx}`);
                    if (this.currentSignValue) this.currentSignValue.textContent = this.selectedSignText;
                    if (this.signDropdown) this.signDropdown.style.display = 'none';
                }
            } else {
                // Click outside closes dropdown
                if (this.signDropdown && !e.target.closest('.sign-dropdown')) {
                    this.signDropdown.style.display = 'none';
                }
            }
        });
        
        // Zoom control events
    if (this.zoomInBtn) this.zoomInBtn.addEventListener('click', () => this.zoomIn());
    if (this.zoomOutBtn) this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
    if (this.zoomFitBtn) this.zoomFitBtn.addEventListener('click', () => this.zoomToFit());
    if (this.prevPageBtn) this.prevPageBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prevPage(); });
    if (this.nextPageBtn) this.nextPageBtn.addEventListener('click', (e) => { e.stopPropagation(); this.nextPage(); });
    if (this.sidePrevBtn) this.sidePrevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prevPage(); });
    if (this.sideNextBtn) this.sideNextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.nextPage(); });
        
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
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.zoomToFit();
                }
            }
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
    }

    goToPage(pageNum) {
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
                    
                    // Restore signature fields if signers match
                    const currentSignerIds = this.signers.map(s => s.id);
                    const validFields = data.fields.filter(field => 
                        currentSignerIds.includes(field.signerId)
                    );
                    
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

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        canvas.dataset.pageNumber = pageNum;

        const overlay = document.createElement('div');
        overlay.className = 'page-signature-overlay';
        overlay.dataset.pageNumber = pageNum;

    pageWrapper.appendChild(pageNumber);
        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(overlay);
        this.documentPagesContainer.appendChild(pageWrapper);

        // Render the PDF page, but first compute fit-to-container scale
        const page = await this.pdfDocument.getPage(pageNum);

        // Get native page size using scale = 1 viewport
        const unscaledViewport = page.getViewport({ scale: 1 });

        // Compute available container size (subtract minor padding if present)
        const containerRect = this.documentPagesContainer.getBoundingClientRect();
        let availW = containerRect.width || 800; // fallback
        let availH = containerRect.height || 600; // fallback

        // Reserve some space for header/controls inside the wrapper
        const header = pageWrapper.querySelector('.page-number');
        if (header) {
            const headerRect = header.getBoundingClientRect();
            // If headerRect.width === 0 (not yet in flow), approximate 30px
            const headerH = headerRect.height || 28;
            availH = Math.max(50, availH - headerH - 12);
        }

        // Compute fit scale to fit page inside available area
        const scaleX = availW / unscaledViewport.width;
        const scaleY = availH / unscaledViewport.height;
        const fitScale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY) * 0.98));

        // Apply computed scale
        this.scale = fitScale || this.scale;

        const viewport = page.getViewport({ scale: this.scale });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    // set overlay dimensions to match the rendered canvas
    overlay.style.position = 'absolute';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    overlay.style.width = canvas.width + 'px';
    overlay.style.height = canvas.height + 'px';
    overlay.style.pointerEvents = 'none';

        const ctx = canvas.getContext('2d');
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

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
            const prevBtn = this.sidePrevBtn || document.getElementById('side-prev-btn');
            const nextBtn = this.sideNextBtn || document.getElementById('side-next-btn');
            const containerRect = this.documentPagesContainer.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();

            if (prevBtn) {
                const btnW = prevBtn.offsetWidth || 44;
                const btnH = prevBtn.offsetHeight || 44;
                const leftPx = Math.max(4, canvasRect.left - containerRect.left - btnW - 8);
                const topPx = Math.max(4, canvasRect.top - containerRect.top + (canvasRect.height - btnH) / 2);
                prevBtn.style.position = 'absolute';
                prevBtn.style.left = leftPx + 'px';
                prevBtn.style.top = topPx + 'px';
                prevBtn.style.display = 'inline-flex';
                prevBtn.style.zIndex = '1200';
            }

            if (nextBtn) {
                const btnW = nextBtn.offsetWidth || 44;
                const btnH = nextBtn.offsetHeight || 44;
                const leftPx = Math.min(containerRect.width - btnW - 4, canvasRect.left - containerRect.left + canvasRect.width + 8);
                const topPx = Math.max(4, canvasRect.top - containerRect.top + (canvasRect.height - btnH) / 2);
                nextBtn.style.position = 'absolute';
                nextBtn.style.left = leftPx + 'px';
                nextBtn.style.top = topPx + 'px';
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
        // No longer require signer selection - place signatures anonymously
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // Create an editable, resizable textarea so user can edit text and resize to change size
        overlay.style.pointerEvents = 'auto';

        const textarea = document.createElement('textarea');
        textarea.className = 'signature-textarea';
        textarea.value = this.selectedSignText || '';
        textarea.style.position = 'absolute';
        textarea.style.left = x + 'px';
        textarea.style.top = y + 'px';
        textarea.style.width = '180px';
        textarea.style.height = '48px';
        textarea.style.fontSize = '20px';
        textarea.style.resize = 'both';
        textarea.style.padding = '6px 8px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.zIndex = '2000';
        textarea.setAttribute('placeholder', 'Type signature text and press Enter to place');
        overlay.appendChild(textarea);
        textarea.focus();

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

        // Finalize placement on Enter
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const finalText = textarea.value.trim();
                if (!finalText) {
                    // if empty, just remove
                    overlay.removeChild(textarea);
                    overlay.style.pointerEvents = 'none';
                    return;
                }

                // Create the field object and save
                const rectNow = canvas.getBoundingClientRect();
                const left = parseFloat(textarea.style.left);
                const top = parseFloat(textarea.style.top);
                const w = textarea.offsetWidth;
                const h = textarea.offsetHeight;

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
                    relativeX: left / canvas.width,
                    relativeY: top / canvas.height,
                    relativeWidth: w / canvas.width,
                    relativeHeight: h / canvas.height
                };

                this.signatureFields.push(field);
                // cleanup
                if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
                overlay.style.pointerEvents = 'none';
                this.renderSignatureFields();
                this.showToast(`Signature placed on page ${pageNumber}`, 'success');
            }
        });
    }

    renderSignatureFields() {
        // Clear all existing signature fields from all page overlays
        document.querySelectorAll('.page-signature-overlay').forEach(overlay => {
            overlay.innerHTML = '';
        });
        
        this.signatureFields.forEach(field => {
            const overlay = document.querySelector(`.page-signature-overlay[data-page-number="${field.page}"]`);
            const canvas = document.querySelector(`.pdf-page-canvas[data-page-number="${field.page}"]`);
            if (!overlay || !canvas) return;

            // Calculate absolute position from relative coordinates
            const x = field.relativeX * canvas.width;
            const y = field.relativeY * canvas.height;
            const width = field.relativeWidth * canvas.width;
            const height = field.relativeHeight * canvas.height;

            const fieldElement = document.createElement('div');
            fieldElement.className = 'signature-field';
            fieldElement.dataset.fieldType = field.type;
            fieldElement.dataset.fieldId = field.id;
            fieldElement.style.left = x + 'px';
            fieldElement.style.top = y + 'px';
            fieldElement.style.width = width + 'px';
            fieldElement.style.height = height + 'px';
            
            const fieldLabel = document.createElement('div');
            fieldLabel.className = 'field-label';
            fieldLabel.textContent = field.signText || 'SIGNATURE';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-field';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeSignatureField(field.id);
            };
            
            fieldElement.appendChild(fieldLabel);
            fieldElement.appendChild(deleteBtn);
            
            fieldElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectField(field);
            });
            
            // Make fields draggable
            this.makeFieldDraggable(fieldElement, field, overlay, canvas);
            
            overlay.appendChild(fieldElement);
        });
    }

    selectField(field) {
        this.selectedField = field;
        document.querySelectorAll('.signature-field').forEach(el => {
            el.classList.remove('selected');
        });
        event.target.classList.add('selected');
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
                relativeX: field.relativeX,
                relativeY: field.relativeY,
                relativeWidth: field.relativeWidth,
                relativeHeight: field.relativeHeight
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

            // For each signature field, draw a rectangle and label on the respective page
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

                // Draw signature text with proper styling
                const labelText = field.signText || 'SIGNATURE';
                
                // Increase font size for better visibility
                const fontSize = Math.max(14, h * 0.8);
                
                // Center the text within the field bounds
                const textWidth = labelText.length * (fontSize * 0.6); // approximate text width
                const textX = x + (w - textWidth) / 2;
                const textY = y + (h - fontSize) / 2;
                
                // Draw a subtle background for the signature
                page.drawRectangle({ 
                    x, 
                    y, 
                    width: w, 
                    height: h, 
                    borderColor: pdfLib.rgb(0.2, 0.2, 0.8), 
                    borderWidth: 2, 
                    color: pdfLib.rgb(0.95, 0.95, 1), 
                    opacity: 0.8 
                });
                
                // Draw the signature text in dark blue
                page.drawText(labelText, { 
                    x: Math.max(x + 4, textX), 
                    y: Math.max(y + 4, textY), 
                    size: fontSize, 
                    color: pdfLib.rgb(0, 0, 0.8)
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
            
            // Calculate new position relative to canvas
            let newX = e.clientX - canvasRect.left - dragOffsetX;
            let newY = e.clientY - canvasRect.top - dragOffsetY;
            
            // Convert to relative coordinates
            const newRelativeX = newX / canvas.width;
            const newRelativeY = newY / canvas.height;
            
            // Constrain to canvas bounds
            const constrainedX = Math.max(0, Math.min(1 - field.relativeWidth, newRelativeX));
            const constrainedY = Math.max(0, Math.min(1 - field.relativeHeight, newRelativeY));
            
            field.relativeX = constrainedX;
            field.relativeY = constrainedY;
            
            // Update visual position with constrained values
            const finalX = constrainedX * canvas.width;
            const finalY = constrainedY * canvas.height;
            
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

    // Zoom functionality methods
    zoomIn() {
        if (this.scale < this.maxScale) {
            this.scale = Math.min(this.maxScale, this.scale + this.scaleStep);
            this.updateZoom();
        }
    }

    zoomOut() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.scaleStep);
            this.updateZoom();
        }
    }

    zoomToFit() {
        // Compute a fit-to-container scale for the current page and re-render
        if (!this.pdfDocument) return;

        const numPages = this.pdfDocument.numPages;
        if (!this.currentPage || this.currentPage < 1) this.currentPage = 1;
        if (this.currentPage > numPages) this.currentPage = numPages;

        // Get the page and compute unscaled size
        this.pdfDocument.getPage(this.currentPage).then(page => {
            const unscaled = page.getViewport({ scale: 1 });
            const containerRect = this.documentPagesContainer.getBoundingClientRect();
            let availW = containerRect.width || 800;
            let availH = containerRect.height || 600;

            // Account for header space if present
            const header = this.documentPagesContainer.querySelector('.page-number');
            if (header) {
                const headerRect = header.getBoundingClientRect();
                const headerH = headerRect.height || 28;
                availH = Math.max(50, availH - headerH - 12);
            }

            const scaleX = availW / unscaled.width;
            const scaleY = availH / unscaled.height;
            const fitScale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY) * 0.98));
            this.scale = fitScale || this.scale;
            this.updateZoom();
        }).catch(err => {
            console.warn('zoomToFit failed to get page:', err);
            this.scale = 1.0;
            this.updateZoom();
        });
    }

    updateZoom() {
        // Store current signature field positions as percentages before re-rendering
        const fieldsAsPercentages = this.signatureFields.map(field => {
            const canvas = document.querySelector(`.pdf-page-canvas[data-page-number="${field.page}"]`);
            if (canvas && canvas.width > 0 && canvas.height > 0) {
                return {
                    ...field,
                    xPercent: (field.x / canvas.width) * 100,
                    yPercent: (field.y / canvas.height) * 100,
                    widthPercent: (field.width / canvas.width) * 100,
                    heightPercent: (field.height / canvas.height) * 100
                };
            }
            return field;
        });

        this.zoomLevel.textContent = Math.round(this.scale * 100) + '%';
        
        // Re-render all pages at new scale
        this.renderAllPages().then(() => {
            // Restore signature fields with recalculated positions
            this.signatureFields = fieldsAsPercentages.map(field => {
                const canvas = document.querySelector(`.pdf-page-canvas[data-page-number="${field.page}"]`);
                if (canvas && field.xPercent !== undefined) {
                    return {
                        ...field,
                        x: Math.round((field.xPercent / 100) * canvas.width),
                        y: Math.round((field.yPercent / 100) * canvas.height),
                        width: Math.round((field.widthPercent / 100) * canvas.width),
                        height: Math.round((field.heightPercent / 100) * canvas.height)
                    };
                }
                return field;
            });
            
            // Re-render signature fields at new positions
            this.renderSignatureFields();
        });
    }
}

// Initialize the eSign processor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.eSignProcessor = new ESignProcessor();
});
