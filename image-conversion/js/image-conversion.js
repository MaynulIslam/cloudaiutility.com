// Image Conversion Tool - Advanced Image Format Converter
class ImageConverter {
    constructor() {
        this.files = [];
        this.convertedFiles = [];
        this.currentSettings = {
            outputFormat: 'jpg',
            quality: 85,
            resizeMode: 'none',
            resizeValue: 100,
            resizeWidth: 800,
            resizeHeight: 600,
            maxDimension: 1920,
            maintainAspect: true,
            removeMetadata: false,
            progressiveJPEG: false
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');

        browseBtn.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Settings
        this.setupSettingsListeners();

        // Actions
        document.getElementById('start-conversion').addEventListener('click', () => {
            this.startConversion();
        });

        document.getElementById('clear-all').addEventListener('click', () => {
            this.clearAll();
        });

        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetSettings();
        });

        // Results actions
        document.getElementById('download-all').addEventListener('click', () => {
            this.downloadAllAsZip();
        });

        document.getElementById('start-new').addEventListener('click', () => {
            this.startNew();
        });
    }

    setupSettingsListeners() {
        // Output format
        document.getElementById('output-format').addEventListener('change', (e) => {
            this.currentSettings.outputFormat = e.target.value;
            this.updateFormatSpecificOptions();
        });

        // Quality slider
        const qualitySlider = document.getElementById('quality');
        const qualityValue = document.getElementById('quality-value');
        qualitySlider.addEventListener('input', (e) => {
            this.currentSettings.quality = parseInt(e.target.value);
            qualityValue.textContent = e.target.value + '%';
        });

        // Resize mode
        document.getElementById('resize-mode').addEventListener('change', (e) => {
            this.currentSettings.resizeMode = e.target.value;
            this.updateResizeOptions();
        });

        // Checkboxes
        document.getElementById('maintain-aspect').addEventListener('change', (e) => {
            this.currentSettings.maintainAspect = e.target.checked;
        });

        document.getElementById('remove-metadata').addEventListener('change', (e) => {
            this.currentSettings.removeMetadata = e.target.checked;
        });

        document.getElementById('progressive-jpeg').addEventListener('change', (e) => {
            this.currentSettings.progressiveJPEG = e.target.checked;
        });
    }

    handleFiles(fileList) {
        const newFiles = Array.from(fileList).filter(file => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showToast(`Skipped ${file.name}: Not an image file`, 'warning');
                return false;
            }

            // Validate file size (50MB limit)
            if (file.size > 50 * 1024 * 1024) {
                this.showToast(`Skipped ${file.name}: File too large (max 50MB)`, 'warning');
                return false;
            }

            // Check for duplicates
            if (this.files.some(f => f.name === file.name && f.size === file.size)) {
                this.showToast(`Skipped ${file.name}: Already added`, 'warning');
                return false;
            }

            return true;
        });

        // Add unique ID to each file
        newFiles.forEach(file => {
            file.id = Date.now() + Math.random().toString(36).substr(2, 9);
        });

        this.files.push(...newFiles);

        // Check total file limit (50 files)
        if (this.files.length > 50) {
            const excess = this.files.length - 50;
            this.files = this.files.slice(0, 50);
            this.showToast(`Added first 50 files, removed ${excess} excess files`, 'warning');
        }

        // Check total size limit (200MB)
        const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > 200 * 1024 * 1024) {
            this.showToast('Total file size exceeds 200MB limit', 'error');
            // Remove files until under limit
            while (this.files.reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024) {
                this.files.pop();
            }
        }

        this.updateUI();
        this.renderFileList();

        if (this.files.length > 0) {
            this.showToast(`Added ${newFiles.length} file(s). Total: ${this.files.length}`, 'success');
        }
    }

    updateFormatSpecificOptions() {
        const format = this.currentSettings.outputFormat;
        const progressiveCheckbox = document.getElementById('progressive-jpeg');
        
        // Enable/disable progressive JPEG option
        progressiveCheckbox.disabled = format !== 'jpg';
        if (format !== 'jpg') {
            progressiveCheckbox.checked = false;
            this.currentSettings.progressiveJPEG = false;
        }
    }

    updateResizeOptions() {
        const resizeMode = this.currentSettings.resizeMode;
        const resizeValues = document.getElementById('resize-values');
        const resizeInputs = document.getElementById('resize-inputs');
        const resizeLabel = document.getElementById('resize-label');

        if (resizeMode === 'none') {
            resizeValues.style.display = 'none';
            return;
        }

        resizeValues.style.display = 'block';
        resizeInputs.innerHTML = '';

        switch (resizeMode) {
            case 'percentage':
                resizeLabel.textContent = 'Percentage';
                resizeInputs.innerHTML = `
                    <input type="number" id="resize-percentage" min="10" max="500" value="100">
                    <span>%</span>
                `;
                document.getElementById('resize-percentage').addEventListener('change', (e) => {
                    this.currentSettings.resizeValue = parseInt(e.target.value);
                });
                break;
                
            case 'dimensions':
                resizeLabel.textContent = 'Dimensions';
                resizeInputs.innerHTML = `
                    <input type="number" id="resize-width" min="1" max="8000" value="800">
                    <span>×</span>
                    <input type="number" id="resize-height" min="1" max="8000" value="600">
                    <span>px</span>
                `;
                document.getElementById('resize-width').addEventListener('change', (e) => {
                    this.currentSettings.resizeWidth = parseInt(e.target.value);
                });
                document.getElementById('resize-height').addEventListener('change', (e) => {
                    this.currentSettings.resizeHeight = parseInt(e.target.value);
                });
                break;
                
            case 'max-dimension':
                resizeLabel.textContent = 'Max Dimension';
                resizeInputs.innerHTML = `
                    <input type="number" id="max-dimension" min="100" max="8000" value="1920">
                    <span>px</span>
                `;
                document.getElementById('max-dimension').addEventListener('change', (e) => {
                    this.currentSettings.maxDimension = parseInt(e.target.value);
                });
                break;
        }
    }

    renderFileList() {
        const fileList = document.getElementById('file-list');
        const fileListSection = document.getElementById('file-list-section');
        const totalFiles = document.getElementById('total-files');

        if (this.files.length === 0) {
            fileListSection.style.display = 'none';
            return;
        }

        fileListSection.style.display = 'block';
        totalFiles.textContent = `(${this.files.length})`;

        fileList.innerHTML = this.files.map(file => {
            const fileSize = this.formatFileSize(file.size);
            const fileType = file.type.split('/')[1].toUpperCase();
            
            return `
                <div class="file-item" data-file-id="${file.id}">
                    <img class="file-preview" src="${URL.createObjectURL(file)}" alt="Preview" loading="lazy">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-details">${fileType} • ${fileSize}</div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-small btn-remove" onclick="imageConverter.removeFile('${file.id}')">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    removeFile(fileId) {
        this.files = this.files.filter(file => file.id !== fileId);
        this.updateUI();
        this.renderFileList();
        this.showToast('File removed', 'info');
    }

    async startConversion() {
        if (this.files.length === 0) {
            this.showToast('No files to convert', 'error');
            return;
        }

        // Show progress section
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        
        // Disable conversion button
        const convertBtn = document.getElementById('start-conversion');
        convertBtn.disabled = true;
        convertBtn.querySelector('.btn-text').textContent = 'Converting...';

        this.convertedFiles = [];
        const totalFiles = this.files.length;
        let processedFiles = 0;

        try {
            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                
                // Update current file display
                document.getElementById('current-file').textContent = 
                    `Converting: ${file.name} (${i + 1}/${totalFiles})`;

                try {
                    const convertedFile = await this.convertFile(file);
                    this.convertedFiles.push(convertedFile);
                    processedFiles++;
                } catch (error) {
                    console.error(`Error converting ${file.name}:`, error);
                    this.showToast(`Failed to convert ${file.name}: ${error.message}`, 'error');
                }

                // Update progress
                const progress = ((i + 1) / totalFiles) * 100;
                document.getElementById('overall-progress').style.width = progress + '%';
                document.getElementById('progress-text').textContent = 
                    `${Math.round(progress)}% (${i + 1}/${totalFiles})`;

                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Show results
            this.showResults();

        } catch (error) {
            console.error('Conversion error:', error);
            this.showToast('Conversion failed: ' + error.message, 'error');
        } finally {
            // Re-enable conversion button
            convertBtn.disabled = false;
            convertBtn.querySelector('.btn-text').textContent = 'Convert Images';
        }
    }

    async convertFile(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                try {
                    // Calculate dimensions
                    let { width, height } = this.calculateDimensions(img.width, img.height);

                    // Set canvas size
                    canvas.width = width;
                    canvas.height = height;

                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to desired format
                    const outputFormat = this.getOutputMimeType();
                    const quality = this.currentSettings.quality / 100;

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to convert image'));
                            return;
                        }

                        // Create new filename
                        const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
                        const extension = this.getFileExtension();
                        const newFilename = `${originalName}_converted.${extension}`;

                        // Create file object
                        const convertedFile = new File([blob], newFilename, {
                            type: outputFormat,
                            lastModified: Date.now()
                        });

                        // Add metadata
                        convertedFile.originalName = file.name;
                        convertedFile.originalSize = file.size;
                        convertedFile.compressionRatio = ((file.size - blob.size) / file.size * 100).toFixed(1);

                        resolve(convertedFile);
                    }, outputFormat, quality);

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

    calculateDimensions(originalWidth, originalHeight) {
        let width = originalWidth;
        let height = originalHeight;

        switch (this.currentSettings.resizeMode) {
            case 'percentage':
                const scale = this.currentSettings.resizeValue / 100;
                width = Math.round(originalWidth * scale);
                height = Math.round(originalHeight * scale);
                break;

            case 'dimensions':
                width = this.currentSettings.resizeWidth;
                height = this.currentSettings.resizeHeight;
                
                if (this.currentSettings.maintainAspect) {
                    const aspectRatio = originalWidth / originalHeight;
                    if (width / height > aspectRatio) {
                        width = Math.round(height * aspectRatio);
                    } else {
                        height = Math.round(width / aspectRatio);
                    }
                }
                break;

            case 'max-dimension':
                const maxDim = this.currentSettings.maxDimension;
                if (Math.max(width, height) > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                break;
        }

        return { width: Math.max(1, width), height: Math.max(1, height) };
    }

    getOutputMimeType() {
        const format = this.currentSettings.outputFormat;
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

    getFileExtension() {
        const extensions = {
            'jpg': 'jpg',
            'png': 'png',
            'webp': 'webp',
            'gif': 'gif',
            'bmp': 'bmp',
            'ico': 'ico'
        };
        return extensions[this.currentSettings.outputFormat] || 'jpg';
    }

    showResults() {
        document.getElementById('progress-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';

        // Update summary
        const totalOriginalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        const totalConvertedSize = this.convertedFiles.reduce((sum, file) => sum + file.size, 0);
        const avgCompression = ((totalOriginalSize - totalConvertedSize) / totalOriginalSize * 100).toFixed(1);

        document.getElementById('results-summary').innerHTML = `
            <p><strong>${this.convertedFiles.length}</strong> files converted successfully</p>
            <p>Original size: <strong>${this.formatFileSize(totalOriginalSize)}</strong></p>
            <p>New size: <strong>${this.formatFileSize(totalConvertedSize)}</strong></p>
            <p>Space saved: <strong>${avgCompression}%</strong></p>
        `;

        // Render converted files
        this.renderConvertedFiles();
    }

    renderConvertedFiles() {
        const convertedFiles = document.getElementById('converted-files');
        
        convertedFiles.innerHTML = this.convertedFiles.map((file, index) => {
            const fileSize = this.formatFileSize(file.size);
            const originalSize = this.formatFileSize(file.originalSize);
            
            return `
                <div class="converted-file-item">
                    <img class="converted-preview" src="${URL.createObjectURL(file)}" alt="Preview" loading="lazy">
                    <div class="converted-info">
                        <div class="converted-name">${file.name}</div>
                        <div class="converted-details">
                            ${originalSize} → ${fileSize} (${file.compressionRatio}% smaller)
                        </div>
                    </div>
                    <button class="btn-download" onclick="imageConverter.downloadFile(${index})">
                        Download
                    </button>
                </div>
            `;
        }).join('');
    }

    downloadFile(index) {
        const file = this.convertedFiles[index];
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async downloadAllAsZip() {
        if (this.convertedFiles.length === 0) {
            this.showToast('No files to download', 'error');
            return;
        }

        try {
            const zip = new JSZip();
            
            // Add each file to zip
            for (const file of this.convertedFiles) {
                zip.file(file.name, file);
            }

            // Generate zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download zip
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'converted_images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('ZIP file downloaded successfully', 'success');
        } catch (error) {
            console.error('Error creating ZIP:', error);
            this.showToast('Failed to create ZIP file', 'error');
        }
    }

    clearAll() {
        this.files = [];
        this.convertedFiles = [];
        this.updateUI();
        this.renderFileList();
        document.getElementById('progress-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        this.showToast('All files cleared', 'info');
    }

    startNew() {
        this.clearAll();
        document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
    }

    resetSettings() {
        this.currentSettings = {
            outputFormat: 'jpg',
            quality: 85,
            resizeMode: 'none',
            resizeValue: 100,
            resizeWidth: 800,
            resizeHeight: 600,
            maxDimension: 1920,
            maintainAspect: true,
            removeMetadata: false,
            progressiveJPEG: false
        };

        // Update UI controls
        document.getElementById('output-format').value = 'jpg';
        document.getElementById('quality').value = 85;
        document.getElementById('quality-value').textContent = '85%';
        document.getElementById('resize-mode').value = 'none';
        document.getElementById('maintain-aspect').checked = true;
        document.getElementById('remove-metadata').checked = false;
        document.getElementById('progressive-jpeg').checked = false;

        this.updateFormatSpecificOptions();
        this.updateResizeOptions();
        this.showToast('Settings reset to defaults', 'info');
    }

    updateUI() {
        const hasFiles = this.files.length > 0;
        
        // Show/hide settings section
        document.getElementById('settings-section').style.display = hasFiles ? 'block' : 'none';
        
        // Update convert button
        const convertBtn = document.getElementById('start-conversion');
        convertBtn.disabled = !hasFiles;
        document.getElementById('file-count').textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showToast(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 300px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Set color based on type
        const colors = {
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.style.opacity = '1', 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.imageConverter = new ImageConverter();
});
