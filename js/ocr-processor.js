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
        } catch (err) {
            console.error('Error during OCR processing:', err);
            // Provide a more helpful user message when language data is missing or worker failed
            let userMessage = 'Error during OCR processing. Please try again.';
            if (err && err.message) {
                if (err.message.includes('Language data') || err.message.includes('Failed to load language')) {
                    userMessage = `OCR language data for "${document.querySelector('input[name=\"ocr-language\"]:checked')?.value || 'eng'}" is missing. Please ensure language data is available.`;
                } else if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
                    userMessage = 'Network error while fetching OCR resources. Check your connection.';
                } else {
                    userMessage = err.message;
                }
            }

        this.hideLoading();
            this.showToast(userMessage);
            return;
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
            // Ensure Tesseract is available
            if (!window.Tesseract) {
                throw new Error('Tesseract.js is not loaded');
            }

            const selectedLanguage = document.querySelector('input[name="ocr-language"]:checked')?.value || 'eng';
            // Create worker logger
            const workerLogger = (m) => {
                try {
                    const text = JSON.stringify(m);
                    if (m && m.status) {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round((m.progress || 0) * 100);
                            this.updateProgress(pct, `Recognizing text... ${pct}%`);
                        } else if (m.status === 'loading tesseract core') {
                            this.updateProgress(10, 'Loading Tesseract core...');
                        } else if (m.status === 'initializing tesseract') {
                            this.updateProgress(20, 'Initializing Tesseract...');
                        } else if (m.status === 'loading language traineddata') {
                            this.updateProgress(30, 'Loading language data...');
                        } else if (m.status === 'initializing api') {
                            this.updateProgress(40, 'Initializing API...');
                        } else {
                            this.updateProgress(5, m.status);
                        }
                    }
                } catch (e) { 
                    console.warn('workerLogger failed', e); 
                }
            };

            // Use the modern Tesseract.js approach - direct recognition without separate worker creation
            // Process all pages
            this.pageTexts = [];
            this.extractedText = '';
            let totalConfidence = 0;
            let totalWords = 0;

            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const progressBase = ((pageNum - 1) / this.totalPages) * 100;
                const pageProgress = `Page ${pageNum.toString().padStart(2, '0')} - In progress...`;
                this.updateProgress(progressBase, pageProgress);

                const pageCanvas = await this.renderPageToCanvas(pageNum);
                // Use Tesseract.recognize directly - this is more reliable than worker approach
                let result = null;
                try {
                    // Update progress to show recognition in progress
                    this.updateProgress(progressBase + 10, `Page ${pageNum.toString().padStart(2, '0')} - Recognizing text...`);
                    
                    result = await Tesseract.recognize(pageCanvas, selectedLanguage, {
                        logger: (m) => {
                            // Enhanced logger with page-specific progress
                            try {
                                const text = JSON.stringify(m);
                                if (m && m.status) {
                                    if (m.status === 'recognizing text') {
                                        const pct = Math.round((m.progress || 0) * 100);
                                        const pageProgressPct = progressBase + (pct * 0.8); // Scale progress within page
                                        this.updateProgress(pageProgressPct, `Page ${pageNum.toString().padStart(2, '0')} - Recognizing text... ${pct}%`);
                                    } else if (m.status === 'loading tesseract core') {
                                        this.updateProgress(progressBase + 5, `Page ${pageNum.toString().padStart(2, '0')} - Loading Tesseract core...`);
                                    } else if (m.status === 'initializing tesseract') {
                                        this.updateProgress(progressBase + 10, `Page ${pageNum.toString().padStart(2, '0')} - Initializing Tesseract...`);
                                    } else if (m.status === 'loading language traineddata') {
                                        this.updateProgress(progressBase + 15, `Page ${pageNum.toString().padStart(2, '0')} - Loading language data...`);
                                    } else if (m.status === 'initializing api') {
                                        this.updateProgress(progressBase + 20, `Page ${pageNum.toString().padStart(2, '0')} - Initializing API...`);
                                    } else {
                                        this.updateProgress(progressBase + 5, `Page ${pageNum.toString().padStart(2, '0')} - ${m.status}...`);
                                    }
                                }
                            } catch (e) { 
                                console.warn('workerLogger failed', e); 
                            }
                        },
                        cacheMethod: 'none' // Disable caching to avoid issues
                    });
                } catch (recErr) {
                    console.error('[OCR] Recognition failed for page', pageNum, ':', recErr);
                    // Try with minimal options as fallback
                    try {
                        console.warn('[OCR] Retrying page', pageNum, 'with minimal options');
                        this.updateProgress(progressBase + 20, `Page ${pageNum.toString().padStart(2, '0')} - Retrying with fallback...`);
                        result = await Tesseract.recognize(pageCanvas, 'eng');
                    } catch (fallbackErr) {
                        console.error('[OCR] Fallback also failed for page', pageNum, ':', fallbackErr);
                        throw fallbackErr;
                    }
                }

                if (result && result.data) {
                    this.pageTexts.push({
                        page: pageNum,
                        text: result.data.text || '',
                        confidence: result.data.confidence || 0,
                        words: result.data.words || []
                    });

                    this.extractedText += `\n--- Page ${pageNum} ---\n${result.data.text || ''}\n`;
                    totalConfidence += (result.data.confidence || 0);
                    totalWords += (result.data.words || []).length;

                    // Show completion for this page
                    const pageCompletePct = (pageNum / this.totalPages) * 100;
                    this.updateProgress(pageCompletePct, `Page ${pageNum.toString().padStart(2, '0')} - Completed! (${Math.round(result.data.confidence || 0)}% confidence)`);
                } else {
                    console.warn('[OCR] No data returned for page', pageNum);
                    this.pageTexts.push({
                        page: pageNum,
                        text: '',
                        confidence: 0,
                        words: []
                    });

                    // Show completion even if no data
                    const pageCompletePct = (pageNum / this.totalPages) * 100;
                    this.updateProgress(pageCompletePct, `Page ${pageNum.toString().padStart(2, '0')} - Completed (no text found)`);
                }

                // Small delay to show the completion message
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Update results
            const avgConfidence = this.totalPages > 0 ? totalConfidence / this.totalPages : 0;
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
            
            let errorMessage = 'Error during OCR processing: ';
            if (error.message.includes('Tesseract.js is not loaded')) {
                errorMessage += 'Tesseract.js library failed to load. Please refresh the page and try again.';
            } else if (error.message.includes('SetImageFile')) {
                errorMessage += 'OCR engine initialization failed. This may be due to network issues or browser compatibility. Please try refreshing the page.';
            } else if (error.message.includes('fetch')) {
                errorMessage += 'Failed to download language data. Please check your internet connection.';
            } else {
                errorMessage += error.message;
            }
            
            this.showToast(errorMessage, 'error');
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
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Tesseract to be available
    if (window.waitForTesseract) {
        await window.waitForTesseract();
    }
    window.ocrProcessor = new OCRProcessor();
});
