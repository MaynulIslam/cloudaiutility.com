// OCR Processor JavaScript Module
class OCRProcessor {
    constructor() {
        this.uploadedFile = null;
        this.pdfDocument = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.extractedText = '';
        this.pageTexts = [];
        this.ocrWorker = null;
        this.isProcessing = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Upload elements
        this.dropArea = document.getElementById('drop-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        this.fileInfo = document.getElementById('file-info');
        this.startOcrBtn = document.getElementById('start-ocr-btn');
        
        // Options elements
        this.optionsSection = document.getElementById('ocr-options-section');
        this.processOcrBtn = document.getElementById('process-ocr-btn');
        
        // Results elements
        this.resultsSection = document.getElementById('results-section');
        this.pagesProcessed = document.getElementById('pages-processed');
        this.wordsExtracted = document.getElementById('words-extracted');
        this.confidenceLevel = document.getElementById('confidence-level');
        this.extractedTextArea = document.getElementById('extracted-text');
        this.copyTextBtn = document.getElementById('copy-text-btn');
        this.downloadTextBtn = document.getElementById('download-text-btn');
        this.downloadPdfBtn = document.getElementById('download-searchable-pdf-btn');
        
        // Preview elements
        this.previewSection = document.getElementById('page-preview-section');
        this.pageCanvas = document.getElementById('page-canvas');
        this.textOverlay = document.getElementById('text-overlay');
        this.prevPageBtn = document.getElementById('prev-page-btn');
        this.nextPageBtn = document.getElementById('next-page-btn');
        this.pageInfo = document.getElementById('page-info');
        
        // Font size control
        this.fontSizeSlider = document.getElementById('font-size-slider');
        this.fontSizeValue = document.getElementById('font-size-value');
        
        // Loading elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingMessage = document.getElementById('loading-message');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        
        // Toast container
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
        this.startOcrBtn.addEventListener('click', () => this.showOcrOptions());
        this.processOcrBtn.addEventListener('click', () => this.startOcrProcessing());
        this.copyTextBtn.addEventListener('click', () => this.copyText());
        this.downloadTextBtn.addEventListener('click', () => this.downloadText());
        this.downloadPdfBtn.addEventListener('click', () => this.downloadSearchablePdf());
        
        // Page navigation
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
        
        // Font size control
        this.fontSizeSlider.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' && this.extractedText) {
                    this.copyText();
                    e.preventDefault();
                }
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

        this.showLoading('Loading PDF document...');
        
        try {
            this.uploadedFile = file;
            this.fileInfo.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            
            // Load PDF for preview
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
            this.totalPages = this.pdfDocument.numPages;
            
            this.startOcrBtn.disabled = false;
            this.hideLoading();
            this.showToast('PDF loaded successfully! Ready for OCR processing.', 'success');
        } catch (error) {
            console.error('Error processing file:', error);
            this.hideLoading();
            this.showToast('Error loading PDF. Please try again.', 'error');
        }
    }

    showOcrOptions() {
        if (!this.uploadedFile) {
            this.showToast('Please upload a PDF file first.', 'error');
            return;
        }
        
        this.optionsSection.style.display = 'block';
        this.startOcrBtn.textContent = 'OCR Options Configured';
        this.startOcrBtn.disabled = true;
        
        // Scroll to options section
        this.optionsSection.scrollIntoView({ behavior: 'smooth' });
    }

    async startOcrProcessing() {
        if (this.isProcessing) {
            this.showToast('OCR processing is already in progress.', 'warning');
            return;
        }

        this.isProcessing = true;
        this.showLoading('Initializing OCR engine...');
        this.updateProgress(0, 'Initializing OCR engine...');
        
        try {
            // Initialize Tesseract worker
            const selectedLanguage = document.querySelector('input[name="ocr-language"]:checked').value;
            this.ocrWorker = await Tesseract.createWorker(selectedLanguage);
            
            // Process all pages
            this.pageTexts = [];
            this.extractedText = '';
            let totalConfidence = 0;
            let totalWords = 0;
            
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                this.updateProgress(
                    ((pageNum - 1) / this.totalPages) * 100,
                    `Processing page ${pageNum} of ${this.totalPages}...`
                );
                
                const pageCanvas = await this.renderPageToCanvas(pageNum);
                const result = await this.ocrWorker.recognize(pageCanvas);
                
                this.pageTexts.push({
                    page: pageNum,
                    text: result.data.text,
                    confidence: result.data.confidence,
                    words: result.data.words
                });
                
                this.extractedText += `\n--- Page ${pageNum} ---\n${result.data.text}\n`;
                totalConfidence += result.data.confidence;
                totalWords += result.data.words.length;
            }
            
            // Terminate worker
            await this.ocrWorker.terminate();
            this.ocrWorker = null;
            
            // Update results
            const avgConfidence = totalConfidence / this.totalPages;
            this.updateResults(this.totalPages, totalWords, avgConfidence);
            
            // Show results
            this.resultsSection.style.display = 'block';
            this.previewSection.style.display = 'block';
            
            // Render first page preview
            await this.renderPagePreview(1);
            
            this.updateProgress(100, 'OCR processing completed!');
            
            setTimeout(() => {
                this.hideLoading();
                this.showToast('OCR processing completed successfully!', 'success');
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
            }, 1000);
            
        } catch (error) {
            console.error('OCR processing error:', error);
            this.hideLoading();
            this.showToast('Error during OCR processing. Please try again.', 'error');
            
            if (this.ocrWorker) {
                await this.ocrWorker.terminate();
                this.ocrWorker = null;
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async renderPageToCanvas(pageNum) {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext('2d');
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        return canvas;
    }

    async renderPagePreview(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;
        
        this.currentPage = pageNum;
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });
        
        this.pageCanvas.width = viewport.width;
        this.pageCanvas.height = viewport.height;
        
        const ctx = this.pageCanvas.getContext('2d');
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Update navigation
        this.updatePageNavigation();
        
        // Show text regions if available
        this.renderTextOverlay(pageNum);
    }

    renderTextOverlay(pageNum) {
        this.textOverlay.innerHTML = '';
        
        const pageData = this.pageTexts.find(p => p.page === pageNum);
        if (!pageData || !pageData.words) return;
        
        pageData.words.forEach(word => {
            if (word.bbox) {
                const textRegion = document.createElement('div');
                textRegion.className = 'text-region';
                textRegion.style.left = word.bbox.x0 + 'px';
                textRegion.style.top = word.bbox.y0 + 'px';
                textRegion.style.width = (word.bbox.x1 - word.bbox.x0) + 'px';
                textRegion.style.height = (word.bbox.y1 - word.bbox.y0) + 'px';
                textRegion.title = word.text;
                
                this.textOverlay.appendChild(textRegion);
            }
        });
    }

    updateResults(pages, words, confidence) {
        this.pagesProcessed.textContent = pages;
        this.wordsExtracted.textContent = words;
        this.confidenceLevel.textContent = Math.round(confidence) + '%';
        this.extractedTextArea.value = this.extractedText;
    }

    updatePageNavigation() {
        this.pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }

    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.renderPagePreview(this.currentPage - 1);
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.renderPagePreview(this.currentPage + 1);
        }
    }

    updateFontSize(size) {
        this.fontSizeValue.textContent = size + 'px';
        this.extractedTextArea.style.fontSize = size + 'px';
    }

    // Action methods
    async copyText() {
        if (!this.extractedText) {
            this.showToast('No text to copy.', 'warning');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(this.extractedText);
            this.showToast('Text copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            this.extractedTextArea.select();
            document.execCommand('copy');
            this.showToast('Text copied to clipboard!', 'success');
        }
    }

    downloadText() {
        if (!this.extractedText) {
            this.showToast('No text to download.', 'warning');
            return;
        }
        
        const blob = new Blob([this.extractedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.uploadedFile.name.replace('.pdf', '_extracted_text.txt');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Text file downloaded!', 'success');
    }

    downloadSearchablePdf() {
        // This would typically require a backend service to create a searchable PDF
        // For now, we'll show a message about this feature
        this.showToast('Searchable PDF creation requires backend processing. Feature coming soon!', 'info');
    }

    // Progress and loading methods
    updateProgress(percentage, message) {
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = Math.round(percentage) + '%';
        this.loadingMessage.textContent = message;
    }

    showLoading(message) {
        this.loadingMessage.textContent = message;
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    // Utility methods
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

    resetProcessor() {
        this.uploadedFile = null;
        this.pdfDocument = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.extractedText = '';
        this.pageTexts = [];
        
        this.fileInfo.textContent = 'No PDF selected';
        this.startOcrBtn.disabled = true;
        this.startOcrBtn.textContent = 'Start OCR Processing';
        
        this.optionsSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.previewSection.style.display = 'none';
        
        this.extractedTextArea.value = '';
        this.fileInput.value = '';
        
        if (this.ocrWorker) {
            this.ocrWorker.terminate();
            this.ocrWorker = null;
        }
    }
}

// Initialize the OCR processor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ocrProcessor = new OCRProcessor();
});

export default OCRProcessor;
