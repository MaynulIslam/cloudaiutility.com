/**
 * PDF Converter - Convert various file formats to PDF
 * Supports: Images (JPG, PNG, GIF, BMP, WebP, SVG), Text files, HTML, Markdown
 * Version: 1.0.0
 */

class PDFConverter {
  constructor() {
    this.files = new Map();
    this.convertedPdfData = null;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.dragCounter = 0;
    
    // Supported file types
    this.supportedTypes = {
      images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'],
      documents: ['text/plain', 'text/html', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      text: ['text/plain', 'text/html', 'text/markdown', 'text/csv']
    };
    
    this.init();
  }

  async init() {
    try {
      this.initializeElements();
      this.bindEvents();
      this.setupPDFJS();
      console.log('✅ PDF Converter initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PDF Converter:', error);
      this.showError('Failed to initialize PDF converter. Please refresh the page.');
    }
  }

  initializeElements() {
    this.elements = {
      dropArea: document.getElementById('drop-area'),
      fileInput: document.getElementById('file-input'),
      browseBtn: document.getElementById('browse-btn'),
      fileInfo: document.getElementById('file-info'),
      fileTags: document.getElementById('file-tags'),
      convertBtn: document.getElementById('convert-files-btn'),
      downloadSection: document.getElementById('download-section'),
      downloadBtn: document.getElementById('download-btn'),
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingMessage: document.getElementById('loading-message'),
      toastContainer: document.getElementById('toast-container')
    };

    // Validate required elements
    const requiredElements = ['dropArea', 'fileInput', 'convertBtn'];
    for (const elementName of requiredElements) {
      if (!this.elements[elementName]) {
        throw new Error(`Required element '${elementName}' not found`);
      }
    }
  }

  bindEvents() {
    // File input events
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.browseBtn?.addEventListener('click', () => this.elements.fileInput.click());

    // Drag and drop events
    this.elements.dropArea.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    this.elements.dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.elements.dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.elements.dropArea.addEventListener('drop', (e) => this.handleDrop(e));

    // Convert button
    this.elements.convertBtn.addEventListener('click', () => this.startConversion());

    // Download button
    this.elements.downloadBtn?.addEventListener('click', () => this.downloadPDF());

    console.log('✅ Event listeners bound successfully');
  }

  setupPDFJS() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      console.log('✅ PDF.js configured successfully');
    }
  }

  // ===== FILE HANDLING =====

  async handleFileSelect(e) {
    const files = Array.from(e.target.files);
    await this.processSelectedFiles(files);
  }

  handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter++;
    this.elements.dropArea.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.elements.dropArea.classList.remove('drag-over');
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter = 0;
    this.elements.dropArea.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    await this.processSelectedFiles(files);
  }

  async processSelectedFiles(files) {
    try {
      console.log(`Processing ${files.length} files...`);
      
      for (const file of files) {
        await this.addFile(file);
      }
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to process files:', error);
      this.showError('Failed to process selected files.');
    }
  }

  async addFile(file) {
    try {
      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File "${file.name}" is too large. Maximum size is 50MB.`);
      }

      // Validate file type
      if (!this.isFileTypeSupported(file.type)) {
        throw new Error(`File type "${file.type}" is not supported. Please use supported formats.`);
      }

      const fileRecord = {
        id: this.generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        addedAt: new Date()
      };

      this.files.set(fileRecord.id, fileRecord);
      console.log(`✅ Added file: ${file.name} (${this.formatFileSize(file.size)})`);

    } catch (error) {
      console.error(`❌ Failed to add file "${file.name}":`, error);
      this.showError(error.message);
    }
  }

  isFileTypeSupported(mimeType) {
    return Object.values(this.supportedTypes).some(types => types.includes(mimeType));
  }

  removeFile(fileId) {
    if (this.files.has(fileId)) {
      const file = this.files.get(fileId);
      this.files.delete(fileId);
      console.log(`🗑️ Removed file: ${file.name}`);
      this.updateUI();
    }
  }

  // ===== UI UPDATES =====

  updateUI() {
    this.updateFileInfo();
    this.updateFileTags();
    this.updateConvertButton();
  }

  updateFileInfo() {
    const fileCount = this.files.size;
    if (fileCount === 0) {
      this.elements.fileInfo.textContent = 'No files selected';
    } else {
      const totalSize = Array.from(this.files.values()).reduce((sum, file) => sum + file.size, 0);
      this.elements.fileInfo.textContent = `${fileCount} file${fileCount > 1 ? 's' : ''} selected (${this.formatFileSize(totalSize)})`;
    }
  }

  updateFileTags() {
    if (!this.elements.fileTags) return;
    
    this.elements.fileTags.innerHTML = '';
    
    Array.from(this.files.values()).forEach((fileRecord, index) => {
      const tag = document.createElement('div');
      tag.className = 'file-tag';
      
      const fileType = this.getFileTypeCategory(fileRecord.type);
      const icon = this.getFileIcon(fileType);
      
      tag.innerHTML = `
        <span class="file-tag-icon">${icon}</span>
        <span class="file-tag-name" title="${fileRecord.name}">${this.truncateFilename(fileRecord.name)}</span>
        <button class="file-tag-remove" onclick="pdfConverter.removeFile('${fileRecord.id}')" title="Remove ${fileRecord.name}">×</button>
      `;
      
      this.elements.fileTags.appendChild(tag);
    });
  }

  updateConvertButton() {
    const hasFiles = this.files.size > 0;
    this.elements.convertBtn.disabled = !hasFiles;
    
    if (hasFiles) {
      this.elements.convertBtn.textContent = `Convert ${this.files.size} file${this.files.size > 1 ? 's' : ''} to PDF`;
    } else {
      this.elements.convertBtn.textContent = 'Convert to PDF';
    }
  }

  // ===== PDF CONVERSION =====

  async startConversion() {
    if (this.files.size === 0) {
      this.showError('Please select files to convert');
      return;
    }

    try {
      this.showLoading('Converting files to PDF...');
      
      // Get PDF settings
      const settings = this.getPDFSettings();
      
      // Convert files to PDF
      const pdfData = await this.convertFilesToPDF(settings);
      
      this.convertedPdfData = pdfData;
      this.showDownloadSection();
      this.hideLoading();
      
      this.showSuccess(`Successfully converted ${this.files.size} file${this.files.size > 1 ? 's' : ''} to PDF!`);
      
    } catch (error) {
      console.error('Conversion failed:', error);
      this.hideLoading();
      this.showError(`Conversion failed: ${error.message}`);
    }
  }

  async convertFilesToPDF(settings) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: settings.orientation,
      unit: 'mm',
      format: settings.pageSize
    });

    let isFirstPage = true;
    const files = Array.from(this.files.values());

    for (let i = 0; i < files.length; i++) {
      const fileRecord = files[i];
      this.updateLoadingMessage(`Converting ${fileRecord.name}... (${i + 1}/${files.length})`);

      try {
        if (!isFirstPage) {
          pdf.addPage();
        }

        await this.addFileToPDF(pdf, fileRecord, settings);
        isFirstPage = false;

      } catch (error) {
        console.warn(`Failed to convert ${fileRecord.name}:`, error);
        // Continue with other files
      }
    }

    return pdf.output('arraybuffer');
  }

  async addFileToPDF(pdf, fileRecord, settings) {
    const fileType = this.getFileTypeCategory(fileRecord.type);

    switch (fileType) {
      case 'image':
        await this.addImageToPDF(pdf, fileRecord, settings);
        break;
      case 'text':
        await this.addTextToPDF(pdf, fileRecord, settings);
        break;
      case 'html':
        await this.addHTMLToPDF(pdf, fileRecord, settings);
        break;
      case 'document':
        await this.addDocumentToPDF(pdf, fileRecord, settings);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileRecord.type}`);
    }
  }

  async addImageToPDF(pdf, fileRecord, settings) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              // Get page dimensions
              const pageWidth = pdf.internal.pageSize.getWidth();
              const pageHeight = pdf.internal.pageSize.getHeight();
              const margin = 10;
              const maxWidth = pageWidth - (margin * 2);
              const maxHeight = pageHeight - (margin * 2);

              // Calculate scaled dimensions
              const { width, height } = this.calculateImageDimensions(
                img.width, 
                img.height, 
                maxWidth, 
                maxHeight
              );

              // Center the image
              const x = (pageWidth - width) / 2;
              const y = (pageHeight - height) / 2;

              pdf.addImage(e.target.result, 'JPEG', x, y, width, height);
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = e.target.result;
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(fileRecord.file);
    });
  }

  async addTextToPDF(pdf, fileRecord, settings) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const pageWidth = pdf.internal.pageSize.getWidth();
          const margin = 20;
          const maxWidth = pageWidth - (margin * 2);

          // Add filename as header
          pdf.setFontSize(16);
          pdf.setFont(undefined, 'bold');
          pdf.text(fileRecord.name, margin, margin + 10);

          // Add content
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'normal');
          const lines = pdf.splitTextToSize(text, maxWidth);
          pdf.text(lines, margin, margin + 25);

          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(fileRecord.file);
    });
  }

  async addHTMLToPDF(pdf, fileRecord, settings) {
    // For now, treat HTML as text - can be enhanced later
    return this.addTextToPDF(pdf, fileRecord, settings);
  }

  async addDocumentToPDF(pdf, fileRecord, settings) {
    // Placeholder for document conversion (DOCX, etc.)
    // For now, show a placeholder page
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(16);
    pdf.text(`Document: ${fileRecord.name}`, 20, 30);
    pdf.setFontSize(12);
    pdf.text('Advanced document conversion coming soon!', 20, 50);
    pdf.text('This feature will support DOCX, RTF, and other formats.', 20, 70);
  }

  // ===== UTILITY METHODS =====

  getPDFSettings() {
    return {
      pageSize: document.getElementById('page-size')?.value || 'a4',
      orientation: document.getElementById('page-orientation')?.value || 'portrait',
      imageQuality: document.getElementById('image-quality')?.value || 'high'
    };
  }

  calculateImageDimensions(imgWidth, imgHeight, maxWidth, maxHeight) {
    const aspectRatio = imgWidth / imgHeight;
    
    let width = imgWidth;
    let height = imgHeight;
    
    // Scale down if too large
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  }

  getFileTypeCategory(mimeType) {
    if (this.supportedTypes.images.includes(mimeType)) return 'image';
    if (mimeType === 'text/html') return 'html';
    if (this.supportedTypes.text.includes(mimeType)) return 'text';
    if (this.supportedTypes.documents.includes(mimeType)) return 'document';
    return 'unknown';
  }

  getFileIcon(fileType) {
    const icons = {
      image: '🖼️',
      text: '📄',
      html: '🌐',
      document: '📑',
      unknown: '📄'
    };
    return icons[fileType] || icons.unknown;
  }

  truncateFilename(filename, maxLength = 25) {
    if (filename.length <= maxLength) return filename;
    const ext = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ===== DOWNLOAD =====

  downloadPDF() {
    if (!this.convertedPdfData) {
      this.showError('No PDF data available for download');
      return;
    }

    try {
      const blob = new Blob([this.convertedPdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `converted-files-${new Date().toISOString().split('T')[0]}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      this.showSuccess('PDF downloaded successfully!');
      
    } catch (error) {
      console.error('Download failed:', error);
      this.showError('Failed to download PDF');
    }
  }

  // ===== UI HELPERS =====

  showDownloadSection() {
    if (this.elements.downloadSection) {
      this.elements.downloadSection.style.display = 'block';
      this.elements.downloadSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  showLoading(message = 'Processing...') {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'flex';
    }
    this.updateLoadingMessage(message);
  }

  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'none';
    }
  }

  updateLoadingMessage(message) {
    if (this.elements.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    if (!this.elements.toastContainer) {
      console.log(`[${type.toUpperCase()}] ${message}`);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
      </div>
    `;

    this.elements.toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);

    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
  }
}

// Initialize the converter when the page loads
let pdfConverter;

document.addEventListener('DOMContentLoaded', () => {
  pdfConverter = new PDFConverter();
});

// Export for use in other modules
export default PDFConverter;