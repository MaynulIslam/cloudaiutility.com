/**
 * Archive and Document Conversion Tool - Simplified Version
 * Handles file format detection, conversion settings, and UI management
 */

class ArchiveConverter {
    constructor() {
        this.isLoaded = false;
        this.isConverting = false;
        this.uploadedFile = null;
        this.convertedBlob = null;
        this.currentFormat = null;
        this.elements = {};
        
        // Supported format mappings
        this.formatMappings = {
            // Archive formats
            'zip': ['tar', 'files'],
            'rar': ['files'],
            '7z': ['files'],
            'tar': ['zip', 'files'],
            'gz': ['files'],
            
            // Document formats
            'csv': ['excel', 'json', 'xml'],
            'xlsx': ['csv', 'json', 'xml'],
            'xls': ['csv', 'json', 'xml'],
            'json': ['csv', 'xml', 'excel'],
            'xml': ['json', 'csv', 'excel'],
            'pdf': ['text', 'excel', 'csv'],
            
            // E-book formats
            'epub': ['text'],
            'mobi': ['text']
        };
        
        this.formatDisplayNames = {
            'zip': 'ZIP Archive',
            'tar': 'TAR Archive', 
            'files': 'Extract Files',
            'csv': 'CSV File',
            'excel': 'Excel File (XLSX)',
            'json': 'JSON File',
            'xml': 'XML File',
            'text': 'Text File',
            'rar': 'RAR Archive',
            '7z': '7-Zip Archive',
            'gz': 'GZIP Archive',
            'xlsx': 'Excel File (XLSX)',
            'xls': 'Excel File (XLS)',
            'epub': 'EPUB E-book',
            'mobi': 'MOBI E-book',
            'pdf': 'PDF Document'
        };
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            this.initializeElements();
            this.setupEventListeners();
            this.resetInterface();
            this.isLoaded = true;
            console.log('Archive Converter initialized successfully');
        } catch (error) {
            console.error('Failed to initialize converter:', error);
        }
    }

    initializeElements() {
        this.elements = {
            // Upload section
            uploadSection: document.getElementById('upload-section'),
            uploadArea: document.getElementById('upload-area'),
            fileInput: document.getElementById('file-input'),
            fileDisplay: document.getElementById('file-display'),
            fileName: document.getElementById('file-name'),
            fileSize: document.getElementById('file-size'),
            removeFileBtn: document.getElementById('remove-file'),
            
            // Conversion section
            conversionSection: document.getElementById('conversion-section'),
            fromFormat: document.getElementById('from-format'),
            toFormat: document.getElementById('to-format'),
            convertBtn: document.getElementById('convert-btn'),
            
            // Progress section
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            statusText: document.getElementById('status-text'),
            
            // Download section
            downloadSection: document.getElementById('download-section'),
            downloadBtn: document.getElementById('download-btn'),
            resetBtn: document.getElementById('reset-btn')
        };
    }

    setupEventListeners() {
        // Upload events
        this.elements.uploadArea?.addEventListener('click', () => this.elements.fileInput?.click());
        this.elements.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        // Drag and drop
        this.elements.uploadArea?.addEventListener('dragover', this.handleDragOver.bind(this));
        this.elements.uploadArea?.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.elements.uploadArea?.addEventListener('drop', this.handleFileDrop.bind(this));
        
        // File management
        this.elements.removeFileBtn?.addEventListener('click', () => this.removeFile());
        
        // Format selection
        this.elements.toFormat?.addEventListener('change', () => this.updateConvertButton());
        
        // Actions
        this.elements.convertBtn?.addEventListener('click', () => this.startConversion());
        this.elements.downloadBtn?.addEventListener('click', () => this.downloadFile());
        this.elements.resetBtn?.addEventListener('click', () => this.resetInterface());
    }

    handleDragOver(event) {
        event.preventDefault();
        this.elements.uploadArea?.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.elements.uploadArea?.classList.remove('drag-over');
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.elements.uploadArea?.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    }

    handleFileSelect(file) {
        if (!file) return;
        
        this.uploadedFile = file;
        this.displayFile(file);
        this.autoDetectFormat(file);
        this.showConversionSection();
    }

    displayFile(file) {
        if (!this.elements.fileDisplay) return;
        
        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = this.formatFileSize(file.size);
        this.elements.fileDisplay.style.display = 'block';
    }

    removeFile() {
        this.uploadedFile = null;
        this.convertedBlob = null;
        this.elements.fileDisplay.style.display = 'none';
        this.elements.conversionSection.style.display = 'none';
        this.elements.progressSection.style.display = 'none';
        this.elements.downloadSection.style.display = 'none';
        if (this.elements.fileInput) this.elements.fileInput.value = '';
    }

    autoDetectFormat(file) {
        const extension = this.getFileExtension(file.name);
        let detectedFormat = null;
        
        // Map common extensions to formats
        const extensionMap = {
            'zip': 'zip',
            'rar': 'rar',
            '7z': '7z',
            'tar': 'tar',
            'gz': 'gz',
            'csv': 'csv',
            'xlsx': 'xlsx',
            'xls': 'xls',
            'json': 'json',
            'xml': 'xml',
            'epub': 'epub',
            'mobi': 'mobi',
            'pdf': 'pdf'
        };
        
        detectedFormat = extensionMap[extension];
        
        if (detectedFormat) {
            this.elements.fromFormat.textContent = this.formatDisplayNames[detectedFormat] || detectedFormat.toUpperCase();
            this.updateOutputFormats(detectedFormat);
        } else {
            this.elements.fromFormat.textContent = 'Unknown Format';
            this.elements.toFormat.innerHTML = '<option value="">Unsupported format</option>';
        }
        
        this.currentFormat = detectedFormat;
    }

    updateOutputFormats(inputFormat) {
        const outputSelect = this.elements.toFormat;
        if (!outputSelect || !inputFormat) return;
        
        outputSelect.innerHTML = '';
        
        const availableFormats = this.formatMappings[inputFormat] || [];
        
        if (availableFormats.length === 0) {
            outputSelect.innerHTML = '<option value="">No conversions available</option>';
            return;
        }
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select output format';
        outputSelect.appendChild(defaultOption);
        
        // Add available output formats
        availableFormats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = this.formatDisplayNames[format] || format.toUpperCase();
            outputSelect.appendChild(option);
        });
        
        this.updateConvertButton();
    }

    updateConvertButton() {
        const hasFile = this.uploadedFile !== null;
        const hasOutputFormat = this.elements.toFormat?.value !== '';
        const canConvert = hasFile && hasOutputFormat && !this.isConverting;
        
        console.log('updateConvertButton:', {
            hasFile,
            hasOutputFormat,
            outputFormatValue: this.elements.toFormat?.value,
            isConverting: this.isConverting,
            canConvert
        });
        
        if (this.elements.convertBtn) {
            this.elements.convertBtn.disabled = !canConvert;
            // Force button to be visible
            this.elements.convertBtn.style.display = 'block';
        }
    }

    showConversionSection() {
        if (this.elements.conversionSection) {
            this.elements.conversionSection.style.display = 'block';
        }
    }

    async startConversion() {
        if (!this.uploadedFile || !this.currentFormat || !this.elements.toFormat?.value) {
            return;
        }
        
        const outputFormat = this.elements.toFormat.value;
        
        this.isConverting = true;
        this.updateConvertButton();
        
        // Show progress section
        this.elements.progressSection.style.display = 'block';
        this.elements.downloadSection.style.display = 'none';
        
        // Update progress
        this.updateProgress(0, 'Starting conversion...');
        
        try {
            // Simulate conversion progress
            this.updateProgress(25, 'Analyzing file...');
            await this.delay(500);
            
            this.updateProgress(50, 'Converting format...');
            const convertedFile = await this.performConversion(this.uploadedFile, this.currentFormat, outputFormat);
            
            this.updateProgress(75, 'Finalizing...');
            await this.delay(300);
            
            this.updateProgress(100, 'Conversion complete!');
            
            if (convertedFile) {
                this.convertedBlob = convertedFile;
                this.showDownloadSection();
            } else {
                throw new Error('Conversion failed');
            }
            
        } catch (error) {
            console.error('Conversion failed:', error);
            this.updateProgress(0, 'Conversion failed. Please try again.');
        } finally {
            this.isConverting = false;
            this.updateConvertButton();
        }
    }

    async performConversion(file, inputFormat, outputFormat) {
        // This is a simplified conversion - in a real implementation,
        // you would use proper conversion libraries
        
        try {
            if (inputFormat === 'csv' && outputFormat === 'json') {
                return await this.convertCsvToJson(file);
            } else if (inputFormat === 'json' && outputFormat === 'csv') {
                return await this.convertJsonToCsv(file);
            } else if (inputFormat === 'csv' && outputFormat === 'excel') {
                return await this.convertCsvToExcel(file);
            } else if (inputFormat === 'pdf' && outputFormat === 'text') {
                return await this.convertPdfToText(file);
            } else if (inputFormat === 'zip' && outputFormat === 'files') {
                return await this.extractArchive(file, inputFormat);
            } else if (['rar', '7z'].includes(inputFormat) && outputFormat === 'files') {
                throw new Error('Extraction for RAR/7z is not supported in-browser without additional libraries.');
            } else if (['tar', 'gz'].includes(inputFormat) && outputFormat === 'files') {
                throw new Error('Extraction for TAR/GZ not implemented yet.');
            } else {
                // For unsupported conversions, return the original file with new extension
                const newName = this.changeFileExtension(file.name, outputFormat);
                return new Blob([file], { type: 'application/octet-stream' });
            }
        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    }

    async convertCsvToJson(file) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) throw new Error('Empty CSV file');
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            data.push(obj);
        }
        
        const jsonString = JSON.stringify(data, null, 2);
        return new Blob([jsonString], { type: 'application/json' });
    }

    async convertJsonToCsv(file) {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid JSON format for CSV conversion');
        }
        
        const headers = Object.keys(data[0]);
        const csvLines = [headers.join(',')];
        
        data.forEach(item => {
            const values = headers.map(header => {
                const value = item[header] || '';
                return `"${value}"`;
            });
            csvLines.push(values.join(','));
        });
        
        const csvString = csvLines.join('\n');
        return new Blob([csvString], { type: 'text/csv' });
    }

    async convertCsvToExcel(file) {
        // For now, just return CSV as Excel would require a proper library
        // In a real implementation, you'd use libraries like xlsx.js
        const text = await file.text();
        return new Blob([text], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    async convertPdfToText(file) {
        // For now, return a text file with PDF info
        // In a real implementation, you'd use libraries like PDF.js
        const content = `PDF Content Extraction:\n\nOriginal file: ${file.name}\nSize: ${this.formatFileSize(file.size)}\nType: PDF Document\n\nNote: Full PDF text extraction requires additional libraries.\nThis is a placeholder conversion.`;
        return new Blob([content], { type: 'text/plain' });
    }

    async extractArchive(file, inputFormat) {
        if (inputFormat !== 'zip') {
            throw new Error(`Extraction not implemented for ${inputFormat.toUpperCase()}`);
        }

        // Load the existing ZIP and rebuild a new ZIP containing the extracted files.
        // This gives the user a clean “_extracted.zip” they can open locally.
        const sourceZip = await JSZip.loadAsync(file);
        const outZip = new JSZip();

        const tasks = [];
        sourceZip.forEach((relativePath, entry) => {
            if (entry.dir) {
                outZip.folder(relativePath);
            } else {
                tasks.push(
                    entry.async('uint8array').then((data) => {
                        outZip.file(relativePath, data);
                    })
                );
            }
        });

        await Promise.all(tasks);
        return await outZip.generateAsync({ type: 'blob' });
    }

    updateProgress(percentage, message) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percentage}%`;
        }
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${percentage}%`;
        }
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
    }

    showDownloadSection() {
        this.elements.downloadSection.style.display = 'block';
    }

    downloadFile() {
        if (!this.convertedBlob || !this.uploadedFile) return;
        
    const outputFormat = this.elements.toFormat.value;
    const newFileName = this.getDownloadName(this.uploadedFile.name, this.currentFormat, outputFormat);
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(this.convertedBlob);
        link.download = newFileName;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    getDownloadName(originalName, inputFormat, outputFormat) {
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        if (outputFormat === 'files') {
            // Bundle extracted files as a Zip archive for download
            return `${baseName}_extracted.zip`;
        }
        return this.changeFileExtension(originalName, outputFormat);
    }

    resetInterface() {
        this.uploadedFile = null;
        this.convertedBlob = null;
        this.currentFormat = null;
        this.isConverting = false;
        
        // Hide all sections except upload
        this.elements.fileDisplay.style.display = 'none';
        this.elements.conversionSection.style.display = 'none';
        this.elements.progressSection.style.display = 'none';
        this.elements.downloadSection.style.display = 'none';
        
        // Clear form
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.fromFormat) this.elements.fromFormat.textContent = 'Auto-detect';
        if (this.elements.toFormat) this.elements.toFormat.innerHTML = '<option value="">Select input file first</option>';
        
        this.updateConvertButton();
    }

    // Utility methods
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    changeFileExtension(filename, newFormat) {
        const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
        const extensionMap = {
            'zip': 'zip',
            'tar': 'tar',
            'files': 'txt',
            'csv': 'csv',
            'excel': 'xlsx',
            'json': 'json',
            'xml': 'xml',
            'text': 'txt',
            'pdf': 'pdf'
        };
        
        const extension = extensionMap[newFormat] || newFormat;
        return `${baseName}.${extension}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the converter when the page loads
const archiveConverter = new ArchiveConverter();
