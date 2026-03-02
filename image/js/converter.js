class ImageConverter {
    constructor() {
        this.files = [];
        this.convertedFiles = [];
        this.currentFormat = 'jpg';
        this.quality = 0.9;
        this.resizeEnabled = false;
        this.resizeWidth = null;
        this.resizeHeight = null;
        this.maintainAspect = true;
        this.isProcessing = false;

        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');

        // Section elements
        this.uploadSection = document.getElementById('upload-section');
        this.fileQueueSection = document.getElementById('file-queue-section');
        this.settingsSection = document.getElementById('settings-section');
        this.processingSection = document.getElementById('processing-section');
        this.resultsSection = document.getElementById('results-section');

        // File queue elements
        this.fileList = document.getElementById('file-list');
        this.fileCount = document.getElementById('file-count');
        this.clearQueueBtn = document.getElementById('clear-queue-btn');
        this.addMoreBtn = document.getElementById('add-more-btn');

        // Settings elements
        this.formatBtns = document.querySelectorAll('.format-btn');
        this.qualitySlider = document.getElementById('quality-slider');
        this.qualityValue = document.getElementById('quality-value');
        this.qualityGroup = document.getElementById('quality-group');
        this.presetBtns = document.querySelectorAll('.preset-btn');
        this.resizeEnabledCheck = document.getElementById('resize-enabled');
        this.resizeOptions = document.getElementById('resize-options');
        this.resizeWidthInput = document.getElementById('resize-width');
        this.resizeHeightInput = document.getElementById('resize-height');
        this.maintainAspectCheck = document.getElementById('maintain-aspect');
        this.sizeBtns = document.querySelectorAll('.size-btn');

        // Action buttons
        this.convertBtn = document.getElementById('convert-btn');
        this.downloadAllBtn = document.getElementById('download-all-btn');
        this.convertMoreBtn = document.getElementById('convert-more-btn');

        // Processing elements
        this.progressText = document.getElementById('progress-text');
        this.progressPercentage = document.getElementById('progress-percentage');
        this.progressFill = document.getElementById('progress-fill');
        this.processingList = document.getElementById('processing-list');

        // Results elements
        this.successCount = document.getElementById('success-count');
        this.errorCount = document.getElementById('error-count');
        this.resultsList = document.getElementById('results-list');

        // Utility elements
        this.toastContainer = document.getElementById('toast-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingMessage = document.getElementById('loading-message');
    }

    setupEventListeners() {
        // File upload events
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.addMoreBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Queue management
        this.clearQueueBtn.addEventListener('click', () => this.clearQueue());

        // Format selection
        this.formatBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectFormat(btn.dataset.format));
        });

        // Quality controls
        this.qualitySlider.addEventListener('input', () => this.updateQuality());
        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setQualityPreset(btn.dataset.quality));
        });

        // Resize controls
        this.resizeEnabledCheck.addEventListener('change', () => this.toggleResize());
        this.resizeWidthInput.addEventListener('input', () => this.handleResizeInput());
        this.resizeHeightInput.addEventListener('input', () => this.handleResizeInput());
        this.maintainAspectCheck.addEventListener('change', () => this.updateMaintainAspect());
        this.sizeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setSizePreset(btn.dataset.size));
        });

        // Action buttons
        this.convertBtn.addEventListener('click', () => this.startConversion());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllFiles());
        this.convertMoreBtn.addEventListener('click', () => this.resetForNewConversion());
    }

    // File handling methods
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.addFiles(files);
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
        
        const files = Array.from(event.dataTransfer.files);
        this.addFiles(files);
    }

    addFiles(newFiles) {
        const validFiles = [];
        const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const maxTotalSize = 100 * 1024 * 1024; // 100MB
        const maxFiles = 20;

        // Check total file limit
        if (this.files.length + newFiles.length > maxFiles) {
            this.showToast(`Maximum ${maxFiles} files allowed. Some files were skipped.`, 'warning');
            newFiles = newFiles.slice(0, maxFiles - this.files.length);
        }

        // Validate each file
        newFiles.forEach(file => {
            // Check file type
            if (!supportedTypes.includes(file.type)) {
                this.showToast(`Unsupported format: ${file.name}. Only JPG, PNG, WebP, GIF, and BMP are supported.`, 'error');
                return;
            }

            // Check file size
            if (file.size > maxFileSize) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                this.showToast(`File too large: ${file.name} (${sizeMB}MB). Max size is 10MB.`, 'error');
                return;
            }

            // Check for duplicates
            const isDuplicate = this.files.some(existingFile => 
                existingFile.name === file.name && existingFile.size === file.size
            );
            
            if (isDuplicate) {
                this.showToast(`Duplicate file skipped: ${file.name}`, 'warning');
                return;
            }

            validFiles.push(file);
        });

        // Check total size
        const currentTotalSize = this.files.reduce((total, file) => total + file.size, 0);
        const newTotalSize = validFiles.reduce((total, file) => total + file.size, 0);
        
        if (currentTotalSize + newTotalSize > maxTotalSize) {
            this.showToast('Total file size exceeds 100MB limit. Some files were skipped.', 'error');
            
            // Add files until we hit the limit
            let addedSize = 0;
            const filesToAdd = [];
            
            for (const file of validFiles) {
                if (currentTotalSize + addedSize + file.size <= maxTotalSize) {
                    filesToAdd.push(file);
                    addedSize += file.size;
                } else {
                    break;
                }
            }
            
            validFiles.length = 0;
            validFiles.push(...filesToAdd);
        }

        if (validFiles.length > 0) {
            this.files.push(...validFiles);
            this.updateFileQueue();
            this.showSections();
            this.showToast(`${validFiles.length} file(s) added successfully!`, 'success');
        }
    }

    updateFileQueue() {
        this.fileCount.textContent = this.files.length;
        this.fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const fileItem = this.createFileItem(file, index);
            this.fileList.appendChild(fileItem);
        });
    }

    createFileItem(file, index) {
        const item = document.createElement('div');
        item.className = 'file-item';

        const preview = document.createElement('img');
        preview.className = 'file-preview';
        preview.alt = file.name;

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        const info = document.createElement('div');
        info.className = 'file-info';

        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = file.name;

        const details = document.createElement('div');
        details.className = 'file-details';
        const sizeKB = (file.size / 1024).toFixed(1);
        const dimensions = 'Loading...';
        details.textContent = `${sizeKB} KB • ${file.type.split('/')[1].toUpperCase()}`;

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
            details.textContent = `${sizeKB} KB • ${img.width}×${img.height} • ${file.type.split('/')[1].toUpperCase()}`;
        };
        img.src = URL.createObjectURL(file);

        info.appendChild(name);
        info.appendChild(details);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove file';
        removeBtn.addEventListener('click', () => this.removeFile(index));

        item.appendChild(preview);
        item.appendChild(info);
        item.appendChild(removeBtn);

        return item;
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileQueue();
        
        if (this.files.length === 0) {
            this.hideSections();
        }
        
        this.showToast('File removed from queue', 'success');
    }

    clearQueue() {
        this.files = [];
        this.updateFileQueue();
        this.hideSections();
        this.showToast('Queue cleared', 'success');
    }

    showSections() {
        this.fileQueueSection.style.display = 'block';
        this.settingsSection.style.display = 'block';
    }

    hideSections() {
        this.fileQueueSection.style.display = 'none';
        this.settingsSection.style.display = 'none';
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
    }

    // Settings methods
    selectFormat(format) {
        this.currentFormat = format;
        
        // Update active button
        this.formatBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === format);
        });

        // Show/hide quality controls
        const supportsQuality = ['jpg', 'webp'].includes(format);
        this.qualityGroup.style.display = supportsQuality ? 'block' : 'none';

        // Update convert button text
        this.convertBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
            </svg>
            Convert to ${format.toUpperCase()}
        `;
    }

    updateQuality() {
        this.quality = this.qualitySlider.value / 100;
        this.qualityValue.textContent = `${this.qualitySlider.value}%`;
        
        // Update active preset
        this.presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.quality === this.qualitySlider.value);
        });
    }

    setQualityPreset(quality) {
        this.qualitySlider.value = quality;
        this.updateQuality();
    }

    toggleResize() {
        this.resizeEnabled = this.resizeEnabledCheck.checked;
        this.resizeOptions.style.display = this.resizeEnabled ? 'block' : 'none';
    }

    handleResizeInput() {
        const width = parseInt(this.resizeWidthInput.value) || null;
        const height = parseInt(this.resizeHeightInput.value) || null;

        if (this.maintainAspect && width && !height) {
            // Calculate height based on first image's aspect ratio
            if (this.files.length > 0) {
                const img = new Image();
                img.onload = () => {
                    const aspectRatio = img.height / img.width;
                    this.resizeHeightInput.value = Math.round(width * aspectRatio);
                };
                img.src = URL.createObjectURL(this.files[0]);
            }
        } else if (this.maintainAspect && height && !width) {
            // Calculate width based on first image's aspect ratio
            if (this.files.length > 0) {
                const img = new Image();
                img.onload = () => {
                    const aspectRatio = img.width / img.height;
                    this.resizeWidthInput.value = Math.round(height * aspectRatio);
                };
                img.src = URL.createObjectURL(this.files[0]);
            }
        }

        this.resizeWidth = parseInt(this.resizeWidthInput.value) || null;
        this.resizeHeight = parseInt(this.resizeHeightInput.value) || null;
    }

    updateMaintainAspect() {
        this.maintainAspect = this.maintainAspectCheck.checked;
    }

    setSizePreset(sizeString) {
        const [width, height] = sizeString.split(',').map(Number);
        this.resizeWidthInput.value = width;
        this.resizeHeightInput.value = height;
        this.handleResizeInput();
    }

    // Conversion methods
    async startConversion() {
        if (this.files.length === 0) {
            this.showToast('No files to convert', 'error');
            return;
        }

        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.convertedFiles = [];
        
        // Show processing section
        this.processingSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        
        // Scroll to processing section
        this.processingSection.scrollIntoView({ behavior: 'smooth' });

        // Initialize progress
        this.updateProgress(0, this.files.length);
        this.initializeProcessingList();

        let successCount = 0;
        let errorCount = 0;

        // Process files one by one
        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            
            try {
                this.updateProcessingItem(i, 'active', 'Converting...');
                
                const convertedFile = await this.convertFile(file, i);
                
                if (convertedFile) {
                    this.convertedFiles.push(convertedFile);
                    this.updateProcessingItem(i, 'success', 'Completed');
                    successCount++;
                } else {
                    this.updateProcessingItem(i, 'error', 'Failed');
                    errorCount++;
                }
                
            } catch (error) {
                console.error('Conversion error:', error);
                this.updateProcessingItem(i, 'error', 'Error: ' + error.message);
                errorCount++;
            }
            
            this.updateProgress(i + 1, this.files.length);
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
        this.showResults(successCount, errorCount);
    }

    async convertFile(file, index) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Calculate dimensions
                    let { width, height } = this.calculateOutputSize(img.width, img.height);
                    
                    canvas.width = width;
                    canvas.height = height;

                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to desired format
                    const mimeType = this.getMimeType(this.currentFormat);
                    const quality = ['jpg', 'webp'].includes(this.currentFormat) ? this.quality : undefined;
                    
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
                            const extension = this.currentFormat === 'jpg' ? 'jpg' : this.currentFormat;
                            const newName = `${originalName}.${extension}`;
                            
                            const convertedFile = new File([blob], newName, { type: mimeType });
                            convertedFile.originalFile = file;
                            convertedFile.originalSize = file.size;
                            convertedFile.newSize = blob.size;
                            
                            resolve(convertedFile);
                        } else {
                            reject(new Error('Failed to convert image'));
                        }
                    }, mimeType, quality);
                    
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = URL.createObjectURL(file);
        });
    }

    calculateOutputSize(originalWidth, originalHeight) {
        if (!this.resizeEnabled) {
            return { width: originalWidth, height: originalHeight };
        }

        let width = this.resizeWidth || originalWidth;
        let height = this.resizeHeight || originalHeight;

        if (this.maintainAspect) {
            if (this.resizeWidth && !this.resizeHeight) {
                height = Math.round((originalHeight / originalWidth) * width);
            } else if (this.resizeHeight && !this.resizeWidth) {
                width = Math.round((originalWidth / originalHeight) * height);
            } else if (this.resizeWidth && this.resizeHeight) {
                // Use the smaller scaling factor to maintain aspect ratio
                const scaleX = width / originalWidth;
                const scaleY = height / originalHeight;
                const scale = Math.min(scaleX, scaleY);
                
                width = Math.round(originalWidth * scale);
                height = Math.round(originalHeight * scale);
            }
        }

        return { width, height };
    }

    getMimeType(format) {
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon'
        };
        return mimeTypes[format] || 'image/jpeg';
    }

    updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        this.progressText.textContent = `${current} of ${total} files processed`;
        this.progressPercentage.textContent = `${percentage}%`;
        this.progressFill.style.width = `${percentage}%`;
    }

    initializeProcessingList() {
        this.processingList.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'processing-item';
            item.id = `processing-item-${index}`;
            
            item.innerHTML = `
                <div class="processing-icon">⏳</div>
                <div class="processing-name">${file.name}</div>
                <div class="processing-status">Waiting...</div>
            `;
            
            this.processingList.appendChild(item);
        });
    }

    updateProcessingItem(index, status, message) {
        const item = document.getElementById(`processing-item-${index}`);
        if (!item) return;

        item.className = `processing-item ${status}`;
        
        const icon = item.querySelector('.processing-icon');
        const statusEl = item.querySelector('.processing-status');
        
        if (status === 'active') {
            icon.textContent = '🔄';
        } else if (status === 'success') {
            icon.textContent = '✅';
        } else if (status === 'error') {
            icon.textContent = '❌';
        }
        
        statusEl.textContent = message;
    }

    showResults(successCount, errorCount) {
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
        
        this.successCount.textContent = successCount;
        this.errorCount.textContent = errorCount;
        
        this.populateResultsList();
        
        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        if (successCount > 0) {
            this.showToast(`Successfully converted ${successCount} file(s)!`, 'success');
        }
        
        if (errorCount > 0) {
            this.showToast(`${errorCount} file(s) failed to convert`, 'error');
        }
    }

    populateResultsList() {
        this.resultsList.innerHTML = '';
        
        this.convertedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'result-item';
            
            const preview = document.createElement('img');
            preview.className = 'result-preview';
            preview.src = URL.createObjectURL(file);
            preview.alt = file.name;
            
            const info = document.createElement('div');
            info.className = 'result-info';
            
            const name = document.createElement('div');
            name.className = 'result-name';
            name.textContent = file.name;
            
            const details = document.createElement('div');
            details.className = 'result-details';
            const originalKB = (file.originalSize / 1024).toFixed(1);
            const newKB = (file.newSize / 1024).toFixed(1);
            const compression = Math.round((1 - file.newSize / file.originalSize) * 100);
            details.textContent = `${originalKB} KB → ${newKB} KB (${compression}% smaller)`;
            
            const actions = document.createElement('div');
            actions.className = 'result-actions';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download';
            downloadBtn.addEventListener('click', () => this.downloadFile(file));
            
            actions.appendChild(downloadBtn);
            info.appendChild(name);
            info.appendChild(details);
            
            item.appendChild(preview);
            item.appendChild(info);
            item.appendChild(actions);
            
            this.resultsList.appendChild(item);
        });
    }

    downloadFile(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async downloadAllFiles() {
        if (this.convertedFiles.length === 0) {
            this.showToast('No files to download', 'error');
            return;
        }

        this.showLoading('Preparing download...');

        try {
            const zip = new JSZip();
            
            // Add files to zip
            for (const file of this.convertedFiles) {
                const arrayBuffer = await file.arrayBuffer();
                zip.file(file.name, arrayBuffer);
            }
            
            // Generate zip
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download zip
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted_images_${this.currentFormat}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.hideLoading();
            this.showToast('Download started!', 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            this.hideLoading();
            this.showToast('Failed to create download. Please try downloading files individually.', 'error');
        }
    }

    resetForNewConversion() {
        this.files = [];
        this.convertedFiles = [];
        this.isProcessing = false;
        
        this.updateFileQueue();
        this.hideSections();
        
        this.uploadSection.style.display = 'block';
        
        this.showToast('Ready for new conversion!', 'success');
    }

    // Utility methods
    showLoading(message = 'Processing...') {
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
    new ImageConverter();
});
