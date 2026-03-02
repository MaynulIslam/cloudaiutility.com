class DocumentConverter {
    constructor() {
        this.currentFile = null;
        this.selectedFormat = null;
        this.convertedFile = null;
        this.isProcessing = false;

        this.initializeElements();
        this.setupEventListeners();
        this.initializePDFJS();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');

        // Section elements
        this.uploadSection = document.getElementById('upload-section');
        this.conversionSection = document.getElementById('conversion-section');
        this.processingSection = document.getElementById('processing-section');
        this.resultsSection = document.getElementById('results-section');

        // File preview elements
        this.fileInfo = document.getElementById('file-info');
        this.changeFileBtn = document.getElementById('change-file-btn');

        // Conversion elements
        this.formatGrid = document.getElementById('format-grid');
        this.settingsPanel = document.getElementById('settings-panel');
        this.convertBtn = document.getElementById('convert-btn');

        // Settings elements
        this.pdfSettings = document.getElementById('pdf-settings');
        this.imageSettings = document.getElementById('image-settings');
        this.textSettings = document.getElementById('text-settings');
        
        // PDF settings
        this.preserveFormattingCheck = document.getElementById('preserve-formatting');
        this.pageSizeSelect = document.getElementById('page-size');
        this.fontSizeSlider = document.getElementById('font-size');
        this.fontSizeValue = document.getElementById('font-size-value');

        // Image settings
        this.imageQualitySlider = document.getElementById('image-quality');
        this.qualityValue = document.getElementById('quality-value');

        // Text settings
        this.textEncodingSelect = document.getElementById('text-encoding');
        this.preserveLineBreaksCheck = document.getElementById('preserve-line-breaks');

        // Processing elements
        this.progressFill = document.getElementById('progress-fill');
        this.progressMessage = document.getElementById('progress-message');
        this.progressPercentage = document.getElementById('progress-percentage');
        this.conversionDetails = document.getElementById('conversion-details');

        // Results elements
        this.conversionSummary = document.getElementById('conversion-summary');
        this.resultPreview = document.getElementById('result-preview');
        this.downloadBtn = document.getElementById('download-btn');
        this.convertAnotherBtn = document.getElementById('convert-another-btn');

        // Utility elements
        this.toastContainer = document.getElementById('toast-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingTitle = document.getElementById('loading-title');
        this.loadingMessage = document.getElementById('loading-message');
    }

    setupEventListeners() {
        // File upload events
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.changeFileBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Conversion events
        this.convertBtn.addEventListener('click', () => this.startConversion());
        this.downloadBtn.addEventListener('click', () => this.downloadFile());
        this.convertAnotherBtn.addEventListener('click', () => this.resetConverter());

        // Settings events
        this.fontSizeSlider.addEventListener('input', () => this.updateFontSizeValue());
        this.imageQualitySlider.addEventListener('input', () => this.updateQualityValue());
    }

    initializePDFJS() {
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    // File handling methods
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadFile(file);
        }
        event.target.value = ''; // Reset input
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.loadFile(files[0]);
        }
    }

    loadFile(file) {
        // Validate file
        if (!this.isValidFile(file)) {
            this.showToast('Unsupported file format. Please select PDF, TXT, CSV, or image files.', 'error');
            return;
        }

        // Check file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            this.showToast(`File too large (${sizeMB}MB). Maximum size is 50MB.`, 'error');
            return;
        }

        this.currentFile = file;
        this.displayFileInfo();
        this.showConversionOptions();
        this.showToast('File loaded successfully!', 'success');
    }

    isValidFile(file) {
        const supportedTypes = [
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/csv',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/gif',
            'image/bmp'
        ];
        return supportedTypes.includes(file.type) || 
               file.name.toLowerCase().match(/\.(pdf|txt|csv|jpg|jpeg|png|gif|bmp)$/);
    }

    displayFileInfo() {
        const fileExtension = this.getFileExtension(this.currentFile.name);
        const fileSize = this.formatFileSize(this.currentFile.size);
        const fileIcon = this.getFileIcon(fileExtension);

        this.fileInfo.innerHTML = `
            <div class="file-icon">${fileIcon}</div>
            <div class="file-details">
                <div class="file-name">${this.currentFile.name}</div>
                <div class="file-meta">${fileExtension.toUpperCase()} • ${fileSize} • ${this.currentFile.type || 'Unknown type'}</div>
            </div>
        `;
    }

    showConversionOptions() {
        this.uploadSection.style.display = 'none';
        this.conversionSection.style.display = 'block';
        this.populateFormatOptions();
    }

    populateFormatOptions() {
        const sourceFormat = this.getFileExtension(this.currentFile.name);
        const availableFormats = this.getAvailableFormats(sourceFormat);

        this.formatGrid.innerHTML = '';
        
        availableFormats.forEach(format => {
            const formatOption = document.createElement('div');
            formatOption.className = 'format-option';
            formatOption.dataset.format = format.type;
            
            formatOption.innerHTML = `
                <span class="format-icon">${format.icon}</span>
                <div class="format-name">${format.name}</div>
                <div class="format-desc">${format.description}</div>
            `;
            
            formatOption.addEventListener('click', () => this.selectFormat(format.type, formatOption));
            this.formatGrid.appendChild(formatOption);
        });
    }

    getAvailableFormats(sourceFormat) {
        const formats = {
            'pdf': [
                { type: 'txt', name: 'Text', icon: '📝', description: 'Extract text content' },
                { type: 'jpg', name: 'Images (JPG)', icon: '🖼️', description: 'Convert pages to images' },
                { type: 'png', name: 'Images (PNG)', icon: '🖼️', description: 'Convert pages to images' }
            ],
            'txt': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create formatted document' }
            ],
            'csv': [
                { type: 'txt', name: 'Text', icon: '📝', description: 'Convert to plain text' },
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create formatted table' }
            ],
            'jpg': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create document from image' },
                { type: 'png', name: 'PNG', icon: '🖼️', description: 'Convert image format' }
            ],
            'jpeg': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create document from image' },
                { type: 'png', name: 'PNG', icon: '🖼️', description: 'Convert image format' }
            ],
            'png': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create document from image' },
                { type: 'jpg', name: 'JPG', icon: '🖼️', description: 'Convert image format' }
            ],
            'gif': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create document from image' },
                { type: 'jpg', name: 'JPG', icon: '🖼️', description: 'Convert image format' },
                { type: 'png', name: 'PNG', icon: '🖼️', description: 'Convert image format' }
            ],
            'bmp': [
                { type: 'pdf', name: 'PDF', icon: '📄', description: 'Create document from image' },
                { type: 'jpg', name: 'JPG', icon: '🖼️', description: 'Convert image format' },
                { type: 'png', name: 'PNG', icon: '🖼️', description: 'Convert image format' }
            ]
        };

        return formats[sourceFormat] || [];
    }

    selectFormat(formatType, formatElement) {
        // Remove previous selection
        document.querySelectorAll('.format-option').forEach(el => {
            el.classList.remove('selected');
        });

        // Select current format
        formatElement.classList.add('selected');
        this.selectedFormat = formatType;

        // Show settings panel and relevant settings
        this.showSettings(formatType);
        this.convertBtn.disabled = false;
    }

    showSettings(targetFormat) {
        this.settingsPanel.style.display = 'block';
        
        // Hide all setting groups
        this.pdfSettings.style.display = 'none';
        this.imageSettings.style.display = 'none';
        this.textSettings.style.display = 'none';

        // Show relevant settings
        if (targetFormat === 'pdf') {
            this.pdfSettings.style.display = 'block';
        } else if (['jpg', 'png'].includes(targetFormat)) {
            this.imageSettings.style.display = 'block';
        } else if (targetFormat === 'txt') {
            this.textSettings.style.display = 'block';
        }
    }

    // Conversion methods
    async startConversion() {
        if (!this.currentFile || !this.selectedFormat || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.showProcessingSection();

        try {
            const sourceFormat = this.getFileExtension(this.currentFile.name);
            
            this.updateProgress(10, 'Reading file...');
            
            let convertedFile;
            
            if (sourceFormat === 'pdf' && this.selectedFormat === 'txt') {
                convertedFile = await this.convertPDFToText();
            } else if (sourceFormat === 'txt' && this.selectedFormat === 'pdf') {
                convertedFile = await this.convertTextToPDF();
            } else if (sourceFormat === 'csv' && this.selectedFormat === 'txt') {
                convertedFile = await this.convertCSVToText();
            } else if (sourceFormat === 'csv' && this.selectedFormat === 'pdf') {
                convertedFile = await this.convertCSVToPDF();
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(sourceFormat) && this.selectedFormat === 'pdf') {
                convertedFile = await this.convertImageToPDF();
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(sourceFormat) && ['jpg', 'png'].includes(this.selectedFormat)) {
                convertedFile = await this.convertImageFormat();
            } else if (sourceFormat === 'pdf' && ['jpg', 'png'].includes(this.selectedFormat)) {
                convertedFile = await this.convertPDFToImages();
            } else {
                throw new Error(`Conversion from ${sourceFormat} to ${this.selectedFormat} is not supported yet.`);
            }

            this.updateProgress(100, 'Conversion complete!');
            this.convertedFile = convertedFile;
            this.showResults();

        } catch (error) {
            console.error('Conversion error:', error);
            this.showToast('Conversion failed: ' + error.message, 'error');
            this.hideProcessingSection();
        }

        this.isProcessing = false;
    }

    // PDF to Text conversion
    async convertPDFToText() {
        this.updateProgress(20, 'Loading PDF...');
        
        const arrayBuffer = await this.currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        let fullText = '';
        const totalPages = pdf.numPages;
        
        for (let i = 1; i <= totalPages; i++) {
            this.updateProgress(20 + (i / totalPages) * 60, `Extracting text from page ${i}/${totalPages}...`);
            
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            
            fullText += pageText + '\n\n';
        }

        this.updateProgress(90, 'Creating text file...');
        
        const blob = new Blob([fullText], { type: 'text/plain' });
        const fileName = this.currentFile.name.replace(/\.pdf$/i, '.txt');
        
        return new File([blob], fileName, { type: 'text/plain' });
    }

    // Text to PDF conversion
    async convertTextToPDF() {
        this.updateProgress(20, 'Reading text file...');
        
        const text = await this.readTextFile(this.currentFile);
        
        this.updateProgress(40, 'Creating PDF...');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            unit: 'pt',
            format: this.pageSizeSelect.value || 'a4'
        });

        const fontSize = parseInt(this.fontSizeSlider.value) || 12;
        pdf.setFontSize(fontSize);

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;
        const lineHeight = fontSize * 1.2;
        const maxWidth = pageWidth - (margin * 2);

        this.updateProgress(60, 'Formatting text...');

        const lines = pdf.splitTextToSize(text, maxWidth);
        let y = margin + fontSize;

        lines.forEach((line, index) => {
            if (y > pageHeight - margin) {
                pdf.addPage();
                y = margin + fontSize;
            }
            
            pdf.text(line, margin, y);
            y += lineHeight;
            
            if (index % 10 === 0) {
                this.updateProgress(60 + (index / lines.length) * 30, 'Adding content to PDF...');
            }
        });

        this.updateProgress(95, 'Finalizing PDF...');
        
        const pdfBlob = pdf.output('blob');
        const fileName = this.currentFile.name.replace(/\.txt$/i, '.pdf');
        
        return new File([pdfBlob], fileName, { type: 'application/pdf' });
    }

    // CSV to Text conversion
    async convertCSVToText() {
        this.updateProgress(30, 'Parsing CSV...');
        
        const csvText = await this.readTextFile(this.currentFile);
        
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    this.updateProgress(70, 'Converting to text format...');
                    
                    let textContent = '';
                    
                    // Add headers
                    if (results.meta.fields) {
                        textContent += results.meta.fields.join('\t') + '\n';
                        textContent += results.meta.fields.map(() => '---').join('\t') + '\n';
                    }
                    
                    // Add data rows
                    results.data.forEach(row => {
                        const values = results.meta.fields ? 
                            results.meta.fields.map(field => row[field] || '') :
                            Object.values(row);
                        textContent += values.join('\t') + '\n';
                    });
                    
                    const blob = new Blob([textContent], { type: 'text/plain' });
                    const fileName = this.currentFile.name.replace(/\.csv$/i, '.txt');
                    
                    resolve(new File([blob], fileName, { type: 'text/plain' }));
                }
            });
        });
    }

    // CSV to PDF conversion
    async convertCSVToPDF() {
        this.updateProgress(30, 'Parsing CSV...');
        
        const csvText = await this.readTextFile(this.currentFile);
        
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    this.updateProgress(50, 'Creating PDF table...');
                    
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({
                        unit: 'pt',
                        format: this.pageSizeSelect.value || 'a4',
                        orientation: 'landscape'
                    });

                    const fontSize = 10;
                    pdf.setFontSize(fontSize);

                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const margin = 20;
                    const tableWidth = pageWidth - (margin * 2);
                    
                    if (results.meta.fields && results.data.length > 0) {
                        const colWidth = tableWidth / results.meta.fields.length;
                        let y = margin + fontSize;

                        // Headers
                        pdf.setFont(undefined, 'bold');
                        results.meta.fields.forEach((header, index) => {
                            pdf.text(header, margin + (index * colWidth), y);
                        });
                        
                        y += fontSize * 1.5;
                        
                        // Draw header line
                        pdf.line(margin, y, pageWidth - margin, y);
                        y += 10;
                        
                        // Data rows
                        pdf.setFont(undefined, 'normal');
                        results.data.forEach((row, rowIndex) => {
                            if (y > pdf.internal.pageSize.getHeight() - 40) {
                                pdf.addPage();
                                y = margin + fontSize;
                            }
                            
                            results.meta.fields.forEach((field, colIndex) => {
                                const value = (row[field] || '').toString();
                                pdf.text(value, margin + (colIndex * colWidth), y);
                            });
                            
                            y += fontSize * 1.2;
                            
                            if (rowIndex % 5 === 0) {
                                this.updateProgress(50 + (rowIndex / results.data.length) * 40, 'Adding table data...');
                            }
                        });
                    }
                    
                    const pdfBlob = pdf.output('blob');
                    const fileName = this.currentFile.name.replace(/\.csv$/i, '.pdf');
                    
                    resolve(new File([pdfBlob], fileName, { type: 'application/pdf' }));
                }
            });
        });
    }

    // Image to PDF conversion
    async convertImageToPDF() {
        this.updateProgress(30, 'Loading image...');
        
        const imageDataUrl = await this.fileToDataURL(this.currentFile);
        const img = await this.loadImage(imageDataUrl);
        
        this.updateProgress(60, 'Creating PDF from image...');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            unit: 'pt',
            format: this.pageSizeSelect.value || 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        
        // Calculate image dimensions to fit page
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);
        
        let { width, height } = this.calculateImageDimensions(img.width, img.height, maxWidth, maxHeight);
        
        // Center the image
        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;
        
        pdf.addImage(imageDataUrl, 'JPEG', x, y, width, height);
        
        this.updateProgress(90, 'Finalizing PDF...');
        
        const pdfBlob = pdf.output('blob');
        const fileName = this.currentFile.name.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '.pdf');
        
        return new File([pdfBlob], fileName, { type: 'application/pdf' });
    }

    // Image format conversion
    async convertImageFormat() {
        this.updateProgress(30, 'Loading image...');
        
        const imageDataUrl = await this.fileToDataURL(this.currentFile);
        const img = await this.loadImage(imageDataUrl);
        
        this.updateProgress(60, 'Converting image format...');
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // If converting to JPG, fill with white background
            if (this.selectedFormat === 'jpg') {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0);
            
            const quality = (parseInt(this.imageQualitySlider.value) / 100) || 0.9;
            const mimeType = this.selectedFormat === 'jpg' ? 'image/jpeg' : 'image/png';
            
            canvas.toBlob((blob) => {
                const fileName = this.currentFile.name.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, `.${this.selectedFormat}`);
                resolve(new File([blob], fileName, { type: mimeType }));
            }, mimeType, quality);
        });
    }

    // PDF to Images conversion
    async convertPDFToImages() {
        this.updateProgress(20, 'Loading PDF...');
        
        const arrayBuffer = await this.currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        // Convert first page to image
        this.updateProgress(50, 'Converting first page to image...');
        
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        return new Promise((resolve) => {
            const quality = (parseInt(this.imageQualitySlider.value) / 100) || 0.9;
            const mimeType = this.selectedFormat === 'jpg' ? 'image/jpeg' : 'image/png';
            
            canvas.toBlob((blob) => {
                const fileName = this.currentFile.name.replace(/\.pdf$/i, `_page1.${this.selectedFormat}`);
                resolve(new File([blob], fileName, { type: mimeType }));
            }, mimeType, quality);
        });
    }

    // Utility methods
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    getFileIcon(extension) {
        const icons = {
            'pdf': '📄',
            'txt': '📝',
            'csv': '📊',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🎞️',
            'bmp': '🖼️'
        };
        return icons[extension] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    calculateImageDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;

        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return { width, height };
    }

    // UI methods
    updateProgress(percentage, message) {
        this.progressFill.style.width = `${percentage}%`;
        this.progressPercentage.textContent = `${Math.round(percentage)}%`;
        this.progressMessage.textContent = message;
        
        if (message !== this.conversionDetails.textContent) {
            this.conversionDetails.textContent = message;
        }
    }

    showProcessingSection() {
        this.conversionSection.style.display = 'none';
        this.processingSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        
        // Scroll to processing section
        this.processingSection.scrollIntoView({ behavior: 'smooth' });
    }

    hideProcessingSection() {
        this.processingSection.style.display = 'none';
        this.conversionSection.style.display = 'block';
    }

    showResults() {
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
        
        // Update conversion summary
        const originalSize = this.formatFileSize(this.currentFile.size);
        const newSize = this.formatFileSize(this.convertedFile.size);
        const sourceFormat = this.getFileExtension(this.currentFile.name).toUpperCase();
        const targetFormat = this.selectedFormat.toUpperCase();
        
        this.conversionSummary.innerHTML = `
            Converted from ${sourceFormat} to ${targetFormat}<br>
            Original: ${originalSize} → New: ${newSize}
        `;

        // Show preview
        this.showResultPreview();
        
        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        this.showToast('Conversion completed successfully!', 'success');
    }

    showResultPreview() {
        const extension = this.getFileExtension(this.convertedFile.name);
        
        if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
            // Show image preview
            const imageUrl = URL.createObjectURL(this.convertedFile);
            this.resultPreview.innerHTML = `
                <img src="${imageUrl}" alt="Converted image" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
            `;
        } else if (extension === 'pdf') {
            // Show PDF info
            this.resultPreview.innerHTML = `
                <div style="text-align: center; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
                    <div style="font-size: 1.2rem; font-weight: 500;">${this.convertedFile.name}</div>
                    <div>PDF Document • ${this.formatFileSize(this.convertedFile.size)}</div>
                </div>
            `;
        } else {
            // Show text preview for text files
            if (this.convertedFile.size < 1024 * 1024) { // < 1MB
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
                    this.resultPreview.innerHTML = `
                        <div style="text-align: left; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem; max-height: 300px; overflow-y: auto; padding: 1rem; background: #f8f9fa; border-radius: 6px;">${preview}</div>
                    `;
                };
                reader.readAsText(this.convertedFile);
            } else {
                this.resultPreview.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                        <div style="font-size: 1.2rem; font-weight: 500;">${this.convertedFile.name}</div>
                        <div>Text Document • ${this.formatFileSize(this.convertedFile.size)}</div>
                    </div>
                `;
            }
        }
    }

    downloadFile() {
        if (!this.convertedFile) return;
        
        const url = URL.createObjectURL(this.convertedFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.convertedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Download started!', 'success');
    }

    resetConverter() {
        this.currentFile = null;
        this.convertedFile = null;
        this.selectedFormat = null;
        this.isProcessing = false;
        
        // Reset UI
        this.uploadSection.style.display = 'block';
        this.conversionSection.style.display = 'none';
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        
        this.convertBtn.disabled = true;
        this.fileInput.value = '';
        
        this.showToast('Ready for new conversion!', 'success');
    }

    updateFontSizeValue() {
        this.fontSizeValue.textContent = `${this.fontSizeSlider.value}px`;
    }

    updateQualityValue() {
        this.qualityValue.textContent = `${this.imageQualitySlider.value}%`;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DocumentConverter();
});
