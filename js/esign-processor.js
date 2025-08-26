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
        
        // Zoom control elements
        this.zoomInBtn = document.getElementById('zoom-in-btn');
        this.zoomOutBtn = document.getElementById('zoom-out-btn');
        this.zoomFitBtn = document.getElementById('zoom-fit-btn');
        this.zoomLevel = document.getElementById('zoom-level');
        
        // Toolbar elements
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn');
        
        // Other elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingMessage = document.getElementById('loading-message');
        this.toastContainer = document.getElementById('toast-container');
    }

    setupEventListeners() {
        // File upload events
        this.dropArea.addEventListener('click', () => this.fileInput.click());
        this.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop events
        this.dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Button events
        this.prepareBtn.addEventListener('click', () => this.prepareDocument());
        this.addSignerBtn.addEventListener('click', () => this.addSigner());
        this.addFieldsBtn.addEventListener('click', () => this.openDocumentPreview());
        this.sendBtn.addEventListener('click', () => this.sendForSignature());
        
        // Modal events
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.completeSetupBtn.addEventListener('click', () => this.completeSetup());
        
        // Toolbar events
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectFieldType(btn.dataset.fieldType));
        });
        
        // Zoom control events
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.zoomFitBtn.addEventListener('click', () => this.zoomToFit());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.closeModal();
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
        this.signerEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSigner();
            }
        });
        
        this.signerName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSigner();
            }
        });
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
        
        this.configSection.style.display = 'block';
        this.prepareBtn.textContent = 'Document Prepared';
        this.prepareBtn.disabled = true;
        
        // Scroll to configuration section
        this.configSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Signer management methods
    addSigner() {
        const name = this.signerName.value.trim();
        const email = this.signerEmail.value.trim();
        
        if (!name || !email) {
            this.showToast('Please enter both name and email.', 'error');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showToast('Please enter a valid email address.', 'error');
            return;
        }
        
        // Check for duplicate emails
        if (this.signers.some(signer => signer.email === email)) {
            this.showToast('This email is already added.', 'error');
            return;
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
        if (this.signers.length === 0) {
            this.signersList.innerHTML = '<p style="color: var(--muted); text-align: center; margin: 1rem 0;">No signers added yet.</p>';
            return;
        }
        
        this.signersList.innerHTML = this.signers.map(signer => `
            <div class="signer-item">
                <div class="signer-info">
                    <div class="signer-name">${this.escapeHtml(signer.name)}</div>
                    <div class="signer-email">${this.escapeHtml(signer.email)}</div>
                </div>
                <button class="remove-signer" onclick="eSignProcessor.removeSigner(${signer.id})">
                    Remove
                </button>
            </div>
        `).join('');
    }

    updateSignerSelect() {
        const options = this.signers.map(signer => 
            `<option value="${signer.id}">${this.escapeHtml(signer.name)}</option>`
        ).join('');
        
        this.fieldSignerSelect.innerHTML = '<option value="">Select signer...</option>' + options;
    }

    // Document preview and signature field methods
    async openDocumentPreview() {
        if (this.signers.length === 0) {
            this.showToast('Please add at least one signer first.', 'error');
            return;
        }
        
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
        if (!this.pdfDocument) return;

        this.documentPagesContainer.innerHTML = '';
        const numPages = this.pdfDocument.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper';
            pageWrapper.dataset.pageNumber = pageNum;

            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = `Page ${pageNum}`;

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

            // Render the PDF page
            const page = await this.pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const ctx = canvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;

            // Add click handler for signature field placement
            canvas.addEventListener('click', (event) => {
                this.addSignatureField(event, pageNum, canvas, overlay);
            });
        }

        this.renderSignatureFields();
    }

    selectFieldType(fieldType) {
        this.currentFieldType = fieldType;
        this.toolbarBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.fieldType === fieldType);
        });
    }

    addSignatureField(event, pageNumber, canvas, overlay) {
        const selectedSignerId = this.fieldSignerSelect.value;
        if (!selectedSignerId) {
            this.showToast('Please select a signer for this field.', 'error');
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Store both absolute and relative coordinates for better precision
        const field = {
            id: Date.now(),
            type: this.currentFieldType,
            signerId: parseInt(selectedSignerId),
            page: pageNumber,
            x: x,
            y: y,
            width: 150,
            height: 40,
            // Store relative coordinates for zoom persistence
            relativeX: x / canvas.width,
            relativeY: y / canvas.height,
            relativeWidth: 150 / canvas.width,
            relativeHeight: 40 / canvas.height
        };
        
        this.signatureFields.push(field);
        this.renderSignatureFields();
        
        const signer = this.signers.find(s => s.id === parseInt(selectedSignerId));
        this.showToast(`${this.currentFieldType} field added for ${signer.name}.`, 'success');
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
            
            const signer = this.signers.find(s => s.id === field.signerId);
            
            const fieldLabel = document.createElement('div');
            fieldLabel.className = 'field-label';
            fieldLabel.textContent = `${field.type.toUpperCase()} - ${signer.name}`;
            
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
        this.sendSection.style.display = 'block';
        this.updateSendSummary();
        this.sendSection.scrollIntoView({ behavior: 'smooth' });
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

    resetForm() {
        this.uploadedFile = null;
        this.signers = [];
        this.signatureFields = [];
        this.pdfDocument = null;
        
        this.fileInfo.textContent = 'No document selected';
        this.prepareBtn.disabled = true;
        this.prepareBtn.textContent = 'Prepare for Signing';
        this.configSection.style.display = 'none';
        this.sendSection.style.display = 'none';
        
        this.renderSignersList();
        this.updateSignerSelect();
        
        this.signerName.value = '';
        this.signerEmail.value = '';
        this.signatureMessage.value = '';
        
        this.fileInput.value = '';
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
        let startX, startY, initialRelativeX, initialRelativeY;

        fieldElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialRelativeX = field.relativeX;
            initialRelativeY = field.relativeY;
            fieldElement.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Convert pixel deltas to relative deltas
            const relativeDeltaX = deltaX / canvas.width;
            const relativeDeltaY = deltaY / canvas.height;
            
            const newRelativeX = Math.max(0, Math.min(1 - field.relativeWidth, initialRelativeX + relativeDeltaX));
            const newRelativeY = Math.max(0, Math.min(1 - field.relativeHeight, initialRelativeY + relativeDeltaY));
            
            field.relativeX = newRelativeX;
            field.relativeY = newRelativeY;
            
            // Update visual position
            const newX = newRelativeX * canvas.width;
            const newY = newRelativeY * canvas.height;
            
            fieldElement.style.left = newX + 'px';
            fieldElement.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                fieldElement.style.cursor = 'move';
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
        // Reset to default scale
        this.scale = 1.2;
        this.updateZoom();
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

export default ESignProcessor;
