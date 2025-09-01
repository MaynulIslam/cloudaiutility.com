// Quick Image Editor - Core Functionality
class ImageEditor {
    constructor() {
        this.originalImage = null;
        this.currentImage = null;
        this.canvas = null;
        this.ctx = null;
        this.cropper = null;
        this.isCropping = false;
        this.history = [];
        this.historyIndex = -1;
        this.textMode = false;
        this.isDraggingText = false;
        this.textElement = null;
        this.textOverlay = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializePica();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        
        // Sections
        this.uploadSection = document.getElementById('upload-section');
        this.editorSection = document.getElementById('editor-section');
        
        // Canvas
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        this.cropperImage = document.getElementById('cropper-image');
        
        // Controls
        this.widthInput = document.getElementById('width-input');
        this.heightInput = document.getElementById('height-input');
        this.maintainAspect = document.getElementById('maintain-aspect');
        this.outputFormat = document.getElementById('output-format');
        this.qualitySlider = document.getElementById('quality-slider');
        this.qualityValue = document.getElementById('quality-value');
        
        // Text controls
        this.textPanel = document.getElementById('text-panel');
        this.textInput = document.getElementById('text-input');
        this.fontSize = document.getElementById('font-size');
        this.fontSizeValue = document.getElementById('font-size-value');
        this.textColor = document.getElementById('text-color');
        this.fontFamily = document.getElementById('font-family');
        
        // Info elements
        this.imageDimensions = document.getElementById('image-dimensions');
        this.fileSize = document.getElementById('file-size');
        
        // Toast container
        this.toastContainer = document.getElementById('toast-container');
    }

    initializePica() {
        if (typeof pica !== 'undefined') {
            this.pica = pica();
        } else {
            console.warn('Pica library not loaded, using canvas resize fallback');
        }
    }

    setupEventListeners() {
        // Upload handlers
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Tool buttons
        document.getElementById('reset-btn').addEventListener('click', () => this.resetImage());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('crop-btn').addEventListener('click', () => this.toggleCrop());
        document.getElementById('rotate-left-btn').addEventListener('click', () => this.rotate(-90));
        document.getElementById('rotate-right-btn').addEventListener('click', () => this.rotate(90));
        document.getElementById('flip-horizontal-btn').addEventListener('click', () => this.flip('horizontal'));
        document.getElementById('flip-vertical-btn').addEventListener('click', () => this.flip('vertical'));
        document.getElementById('add-text-btn').addEventListener('click', () => this.toggleTextMode());
        
        // Control buttons
        document.getElementById('apply-resize-btn').addEventListener('click', () => this.applyResize());
        document.getElementById('apply-text-btn').addEventListener('click', () => this.applyText());
        document.getElementById('cancel-text-btn').addEventListener('click', () => this.cancelText());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadImage());
        
        // Input handlers
        this.widthInput.addEventListener('input', () => this.handleDimensionChange('width'));
        this.heightInput.addEventListener('input', () => this.handleDimensionChange('height'));
        this.qualitySlider.addEventListener('input', () => this.updateQualityDisplay());
        this.fontSize.addEventListener('input', () => this.updateFontSizeDisplay());
        this.outputFormat.addEventListener('change', () => this.handleFormatChange());
        
        // Canvas click for text placement
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    // File handling
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadImageFile(file);
        }
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
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.loadImageFile(files[0]);
        }
    }

    async loadImageFile(file) {
        try {
            this.showToast('Loading image...', 'info');
            
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.currentImage = img;
                this.setupCanvas(img);
                this.saveToHistory();
                this.showEditor();
                this.updateImageInfo(file);
                this.showToast('Image loaded successfully!', 'success');
            };
            img.onerror = () => {
                this.showToast('Error loading image. Please try a different file.', 'error');
            };
            
            img.src = URL.createObjectURL(file);
        } catch (error) {
            console.error('Error loading image:', error);
            this.showToast('Error loading image.', 'error');
        }
    }

    setupCanvas(img) {
        // Set canvas size to fit image while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = this.calculateDisplaySize(img.width, img.height, maxWidth, maxHeight);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Draw image to canvas
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(img, 0, 0, width, height);
        
        // Update dimension inputs
        this.widthInput.value = img.width;
        this.heightInput.value = img.height;
        
        this.updateImageDimensions();
    }

    calculateDisplaySize(imgWidth, imgHeight, maxWidth, maxHeight) {
        const aspectRatio = imgWidth / imgHeight;
        
        let width = imgWidth;
        let height = imgHeight;
        
        if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
        }
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        return { width: Math.round(width), height: Math.round(height) };
    }

    showEditor() {
        this.uploadSection.style.display = 'none';
        this.editorSection.style.display = 'grid';
    }

    // Image operations
    async rotate(degrees) {
        if (!this.currentImage) return;
        
        try {
            this.showLoading();
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // For 90/-90 degree rotations, swap width/height
            if (Math.abs(degrees) === 90) {
                canvas.width = this.currentImage.height;
                canvas.height = this.currentImage.width;
            } else {
                canvas.width = this.currentImage.width;
                canvas.height = this.currentImage.height;
            }
            
            // Apply rotation
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(degrees * Math.PI / 180);
            
            if (Math.abs(degrees) === 90) {
                ctx.drawImage(this.currentImage, -this.currentImage.width / 2, -this.currentImage.height / 2);
            } else {
                ctx.drawImage(this.currentImage, -this.currentImage.width / 2, -this.currentImage.height / 2);
            }
            
            // Create new image from canvas
            const newImg = await this.canvasToImage(canvas);
            this.currentImage = newImg;
            this.setupCanvas(newImg);
            this.saveToHistory();
            
            this.hideLoading();
            this.showToast(`Rotated ${degrees}°`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('Error rotating image', 'error');
        }
    }

    async flip(direction) {
        if (!this.currentImage) return;
        
        try {
            this.showLoading();
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = this.currentImage.width;
            canvas.height = this.currentImage.height;
            
            if (direction === 'horizontal') {
                ctx.scale(-1, 1);
                ctx.drawImage(this.currentImage, -canvas.width, 0);
            } else {
                ctx.scale(1, -1);
                ctx.drawImage(this.currentImage, 0, -canvas.height);
            }
            
            const newImg = await this.canvasToImage(canvas);
            this.currentImage = newImg;
            this.setupCanvas(newImg);
            this.saveToHistory();
            
            this.hideLoading();
            this.showToast(`Flipped ${direction}ly`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('Error flipping image', 'error');
        }
    }

    // Cropping
    toggleCrop() {
        if (this.isCropping) {
            this.exitCrop();
        } else {
            this.enterCrop();
        }
    }

    enterCrop() {
        if (!this.currentImage) return;
        
        this.isCropping = true;
        this.canvas.style.display = 'none';
        this.cropperImage.style.display = 'block';
        
        // Create a high-quality data URL for cropper
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use the original image dimensions for better precision
        tempCanvas.width = this.currentImage.width;
        tempCanvas.height = this.currentImage.height;
        tempCtx.drawImage(this.currentImage, 0, 0);
        
        // Set cropper image source with full resolution
        this.cropperImage.src = tempCanvas.toDataURL('image/png');
        
        // Initialize cropper after image loads
        this.cropperImage.onload = () => {
            this.cropper = new Cropper(this.cropperImage, {
                responsive: true,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                viewMode: 1, // Restrict crop box to within image
                autoCropArea: 0.8, // Default crop area
            });
        };
        
        // Update crop button
        const cropBtn = document.getElementById('crop-btn');
        cropBtn.textContent = 'Apply Crop';
        cropBtn.classList.add('active');
        
        this.showToast('Select area to crop, then click "Apply Crop"', 'info');
    }

    exitCrop() {
        if (!this.cropper) return;
        
        try {
            // Use cropper's built-in canvas method for accurate cropping
            const croppedCanvas = this.cropper.getCroppedCanvas({
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            if (!croppedCanvas) {
                throw new Error('Failed to get cropped canvas');
            }
            
            // Update current image
            this.canvasToImage(croppedCanvas).then(newImg => {
                this.currentImage = newImg;
                this.setupCanvas(newImg);
                this.saveToHistory();
                this.showToast('Image cropped successfully', 'success');
            });
            
        } catch (error) {
            this.showToast('Error cropping image', 'error');
        }
        
        // Cleanup cropper
        this.cropper.destroy();
        this.cropper = null;
        this.isCropping = false;
        
        this.canvas.style.display = 'block';
        this.cropperImage.style.display = 'none';
        
        // Reset crop button
        const cropBtn = document.getElementById('crop-btn');
        cropBtn.textContent = 'Crop';
        cropBtn.classList.remove('active');
    }

    // Resizing
    handleDimensionChange(changedDimension) {
        if (!this.currentImage || !this.maintainAspect.checked) return;
        
        const aspectRatio = this.currentImage.width / this.currentImage.height;
        
        if (changedDimension === 'width') {
            const newWidth = parseInt(this.widthInput.value);
            this.heightInput.value = Math.round(newWidth / aspectRatio);
        } else {
            const newHeight = parseInt(this.heightInput.value);
            this.widthInput.value = Math.round(newHeight * aspectRatio);
        }
    }

    async applyResize() {
        if (!this.currentImage) return;
        
        const newWidth = parseInt(this.widthInput.value);
        const newHeight = parseInt(this.heightInput.value);
        
        if (newWidth <= 0 || newHeight <= 0 || newWidth > 8000 || newHeight > 8000) {
            this.showToast('Please enter valid dimensions (1-8000px)', 'error');
            return;
        }
        
        try {
            this.showLoading();
            
            let resizedImage;
            
            if (this.pica) {
                // Use Pica for high-quality resize
                const sourceCanvas = document.createElement('canvas');
                const sourceCtx = sourceCanvas.getContext('2d');
                sourceCanvas.width = this.currentImage.width;
                sourceCanvas.height = this.currentImage.height;
                sourceCtx.drawImage(this.currentImage, 0, 0);
                
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = newWidth;
                targetCanvas.height = newHeight;
                
                await this.pica.resize(sourceCanvas, targetCanvas);
                resizedImage = await this.canvasToImage(targetCanvas);
            } else {
                // Fallback to canvas resize
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(this.currentImage, 0, 0, newWidth, newHeight);
                resizedImage = await this.canvasToImage(canvas);
            }
            
            this.currentImage = resizedImage;
            this.setupCanvas(resizedImage);
            this.saveToHistory();
            
            this.hideLoading();
            this.showToast(`Resized to ${newWidth}×${newHeight}px`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('Error resizing image', 'error');
        }
    }

    // Text functionality
    toggleTextMode() {
        this.textMode = !this.textMode;
        
        if (this.textMode) {
            this.textPanel.style.display = 'block';
            this.canvas.style.cursor = 'crosshair';
            this.setupTextOverlay();
            this.showToast('Click on the image to add text, then drag to position. Press Enter to apply.', 'info');
        } else {
            this.textPanel.style.display = 'none';
            this.canvas.style.cursor = 'default';
            this.removeTextOverlay();
        }
    }

    setupTextOverlay() {
        if (this.textOverlay) {
            this.removeTextOverlay();
        }
        
        // Create overlay container that matches canvas exactly
        this.textOverlay = document.createElement('div');
        this.textOverlay.style.position = 'absolute';
        this.textOverlay.style.top = '0';
        this.textOverlay.style.left = '0';
        this.textOverlay.style.width = this.canvas.width + 'px';
        this.textOverlay.style.height = this.canvas.height + 'px';
        this.textOverlay.style.pointerEvents = 'none';
        this.textOverlay.style.zIndex = '10';
        this.textOverlay.style.border = '1px dashed rgba(0, 123, 255, 0.3)';
        
        this.canvasWrapper.style.position = 'relative';
        this.canvasWrapper.appendChild(this.textOverlay);
    }

    removeTextOverlay() {
        if (this.textOverlay) {
            this.textOverlay.remove();
            this.textOverlay = null;
        }
        if (this.textElement) {
            this.textElement.remove();
            this.textElement = null;
        }
    }

    handleCanvasClick(event) {
        if (!this.textMode) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.createDraggableText(x, y);
    }

    createDraggableText(x, y) {
        // Remove existing text element
        if (this.textElement) {
            this.textElement.remove();
        }
        
        // Get current text settings
        const text = this.textInput.value.trim() || 'Your text here';
        const fontSize = parseInt(this.fontSize.value);
        const fontFamily = this.fontFamily.value;
        const color = this.textColor.value;
        
        // Create draggable text element
        this.textElement = document.createElement('div');
        this.textElement.style.position = 'absolute';
        this.textElement.style.left = x + 'px';
        this.textElement.style.top = y + 'px';
        this.textElement.style.fontSize = fontSize + 'px';
        this.textElement.style.fontFamily = fontFamily;
        this.textElement.style.color = color;
        this.textElement.style.cursor = 'move';
        this.textElement.style.userSelect = 'none';
        this.textElement.style.pointerEvents = 'all';
        this.textElement.style.background = 'rgba(255,255,255,0.8)';
        this.textElement.style.padding = '4px 8px';
        this.textElement.style.borderRadius = '4px';
        this.textElement.style.border = '2px dashed #007bff';
        this.textElement.style.transform = 'translate(-50%, -50%)';
        this.textElement.textContent = text;
        
        this.textOverlay.appendChild(this.textElement);
        
        // Make draggable
        this.makeDraggable(this.textElement);
        
        // Add keyboard listener for Enter key
        this.addTextKeyListener();
        
        // Update text input to reflect current text
        this.textInput.value = text;
        this.textInput.focus();
    }

    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = element.getBoundingClientRect();
            const parentRect = this.textOverlay.getBoundingClientRect();
            
            initialLeft = rect.left - parentRect.left + rect.width / 2;
            initialTop = rect.top - parentRect.top + rect.height / 2;
            
            element.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = initialLeft + deltaX;
            const newTop = initialTop + deltaY;
            
            // Keep within overlay bounds (which match canvas dimensions)
            const overlayWidth = this.textOverlay.offsetWidth;
            const overlayHeight = this.textOverlay.offsetHeight;
            
            const clampedLeft = Math.max(10, Math.min(overlayWidth - 10, newLeft));
            const clampedTop = Math.max(10, Math.min(overlayHeight - 10, newTop));
            
            element.style.left = clampedLeft + 'px';
            element.style.top = clampedTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }

    addTextKeyListener() {
        const keyHandler = (e) => {
            if (e.key === 'Enter' && this.textElement) {
                this.applyTextFromElement();
                document.removeEventListener('keydown', keyHandler);
            } else if (e.key === 'Escape' && this.textElement) {
                this.cancelText();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        
        document.addEventListener('keydown', keyHandler);
        
        // Update text content when typing
        this.textInput.addEventListener('input', () => {
            if (this.textElement) {
                const newText = this.textInput.value.trim() || 'Your text here';
                this.textElement.textContent = newText;
            }
        });
    }

    async applyTextFromElement() {
        if (!this.textElement || !this.currentImage) return;
        
        try {
            this.showLoading();
            
            // Get text position relative to the text overlay (which matches canvas dimensions)
            const textStyle = this.textElement.style;
            const textX = parseFloat(textStyle.left);
            const textY = parseFloat(textStyle.top);
            
            // Convert overlay coordinates to canvas coordinates (they should match 1:1)
            const canvasX = textX;
            const canvasY = textY;
            
            // Calculate scaling factors from display canvas to original image
            const scaleX = this.currentImage.width / this.canvas.width;
            const scaleY = this.currentImage.height / this.canvas.height;
            
            // Convert to actual image coordinates
            const actualX = canvasX * scaleX;
            const actualY = canvasY * scaleY;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = this.currentImage.width;
            canvas.height = this.currentImage.height;
            
            // Draw current image
            ctx.drawImage(this.currentImage, 0, 0);
            
            // Configure text
            const fontSize = parseInt(this.fontSize.value);
            const fontFamily = this.fontFamily.value;
            const color = this.textColor.value;
            const text = this.textInput.value.trim();
            
            // Scale font size to match image resolution
            const scaleFactor = this.currentImage.width / this.canvas.width;
            const scaledFontSize = fontSize * scaleFactor;
            
            ctx.font = `${scaledFontSize}px ${fontFamily}`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add text with stroke for better visibility
            ctx.strokeStyle = color === '#000000' ? '#ffffff' : '#000000';
            ctx.lineWidth = scaledFontSize * 0.05;
            ctx.strokeText(text, actualX, actualY);
            ctx.fillText(text, actualX, actualY);
            
            const newImg = await this.canvasToImage(canvas);
            this.currentImage = newImg;
            this.setupCanvas(newImg);
            this.saveToHistory();
            
            this.hideLoading();
            this.cancelText();
            this.showToast('Text added successfully! Use Ctrl+Z to undo.', 'success');
            
        } catch (error) {
            this.hideLoading();
            this.showToast('Error adding text', 'error');
            console.error('Text error:', error);
        }
    }

    async applyText() {
        // This method is now replaced by applyTextFromElement
        // Keep for backward compatibility with UI buttons
        if (this.textElement) {
            this.applyTextFromElement();
        } else {
            this.showToast('Please click on the image to add text first', 'error');
        }
    }

    cancelText() {
        this.textMode = false;
        this.textPanel.style.display = 'none';
        this.canvas.style.cursor = 'default';
        this.removeTextOverlay();
        
        // Reset text input
        this.textInput.value = '';
        
        // Clean up old text properties
        this.textX = undefined;
        this.textY = undefined;
    }

    // History management
    saveToHistory() {
        if (!this.currentImage) return;
        
        // Remove any history after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add current state
        this.history.push(this.currentImage);
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 10) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateHistoryButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentImage = this.history[this.historyIndex];
            this.setupCanvas(this.currentImage);
            this.updateHistoryButtons();
            this.showToast('Undone', 'success');
        }
    }

    resetImage() {
        if (this.originalImage) {
            this.currentImage = this.originalImage;
            this.setupCanvas(this.originalImage);
            this.history = [this.originalImage];
            this.historyIndex = 0;
            this.updateHistoryButtons();
            this.showToast('Image reset to original', 'success');
        }
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undo-btn');
        undoBtn.disabled = this.historyIndex <= 0;
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
    }

    // Export functionality
    handleFormatChange() {
        const format = this.outputFormat.value;
        const qualityGroup = document.getElementById('quality-group');
        
        // Show quality slider only for lossy formats
        if (format === 'image/jpeg' || format === 'image/webp') {
            qualityGroup.style.display = 'block';
        } else {
            qualityGroup.style.display = 'none';
        }
    }

    downloadImage() {
        if (!this.currentImage) return;
        
        try {
            const format = this.outputFormat.value;
            const quality = parseFloat(this.qualitySlider.value);
            
            // Create export canvas at original image size
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = this.currentImage.width;
            canvas.height = this.currentImage.height;
            ctx.drawImage(this.currentImage, 0, 0);
            
            // Convert to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const extension = this.getFileExtension(format);
                    const filename = `edited-image-${Date.now()}.${extension}`;
                    
                    if (window.saveAs) {
                        // Use FileSaver.js if available
                        saveAs(blob, filename);
                    } else {
                        // Fallback download method
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                    
                    this.showToast(`Downloaded as ${filename}`, 'success');
                } else {
                    this.showToast('Error creating download file', 'error');
                }
            }, format, quality);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showToast('Error downloading image', 'error');
        }
    }

    getFileExtension(mimeType) {
        const extensions = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/gif': 'gif',
            'image/tiff': 'tiff'
        };
        return extensions[mimeType] || 'png';
    }

    // Utility functions
    async canvasToImage(canvas) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = canvas.toDataURL();
        });
    }

    updateImageInfo(file) {
        if (this.currentImage) {
            this.imageDimensions.textContent = `${this.currentImage.width} × ${this.currentImage.height} px`;
        }
        
        if (file) {
            const sizeKB = (file.size / 1024).toFixed(1);
            this.fileSize.textContent = `${sizeKB} KB`;
        }
    }

    updateImageDimensions() {
        if (this.currentImage) {
            this.imageDimensions.textContent = `${this.currentImage.width} × ${this.currentImage.height} px`;
        }
    }

    updateQualityDisplay() {
        const value = Math.round(this.qualitySlider.value * 100);
        this.qualityValue.textContent = `${value}%`;
    }

    updateFontSizeDisplay() {
        this.fontSizeValue.textContent = `${this.fontSize.value}px`;
    }

    showLoading() {
        this.editorSection.classList.add('loading');
    }

    hideLoading() {
        this.editorSection.classList.remove('loading');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the image editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});
