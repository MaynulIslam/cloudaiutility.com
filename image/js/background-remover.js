// Background Remover - AI-Powered Tool
class BackgroundRemover {
    constructor() {
        this.originalImage = null;
        this.currentBackground = 'transparent';
        this.isProcessing = false;
        this.selfieSegmentation = null;

        this.initializeElements();
        this.setupEventListeners();
        this.initializeAI();
    }

    resetState() {
        // Reset processing state
        this.isProcessing = false;
        this.removeBgBtn.disabled = false;
        this.downloadBtn.style.display = 'none';
        this.transparentResultCanvas = null;

        // Clear canvases
        if (this.resultCanvas) {
            const ctx = this.resultCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
        }
        
        // Reset background selection
        this.currentBackground = 'transparent';
        document.querySelectorAll('.bg-option').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-bg="transparent"]').classList.add('active');
        
        // Hide processing overlay
        this.hideProcessingOverlay();
    }    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        
        // Sections
        this.uploadSection = document.getElementById('upload-section');
        this.processingSection = document.getElementById('processing-section');
        
        // Image elements
        this.originalImageEl = document.getElementById('original-image');
        this.resultCanvas = document.getElementById('result-canvas');
        
        // Controls
        this.removeBgBtn = document.getElementById('remove-bg-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.tryAnotherBtn = document.getElementById('try-another-btn');
        this.backgroundOptions = document.querySelectorAll('.bg-option');
        this.customColorInput = document.getElementById('custom-color');
        this.edgeSmoothingSlider = document.getElementById('edge-smoothing');
        this.smoothingValue = document.getElementById('smoothing-value');
        
        // Overlays
        this.processingOverlay = document.getElementById('processing-overlay');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.toastContainer = document.getElementById('toast-container');
    }

    setupEventListeners() {
        // File upload
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
        
        // Control buttons
        this.removeBgBtn.addEventListener('click', () => this.removeBackground());
        this.downloadBtn.addEventListener('click', () => this.downloadResult());
        this.tryAnotherBtn.addEventListener('click', () => this.resetToUpload());
        
        // Background options
        this.backgroundOptions.forEach(option => {
            option.addEventListener('click', (e) => this.selectBackground(e));
        });
        
        this.customColorInput.addEventListener('change', () => {
            if (this.currentBackground === 'custom') {
                this.applyBackground();
            }
        });
        
        // Quality controls
        this.edgeSmoothingSlider.addEventListener('input', (e) => {
            this.edgeSmoothing = parseInt(e.target.value);
            this.smoothingValue.textContent = this.edgeSmoothing;
            if (this.resultCanvas.getContext('2d').getImageData(0, 0, 1, 1)) {
                this.applyBackground();
            }
        });
    }

    async initializeAI() {
        if (this.selfieSegmentation) {
            // Already initialized
            return;
        }

        this.showLoading('Loading AI model...');
        
        try {
            // Check if MediaPipe is available
            if (typeof SelfieSegmentation === 'undefined') {
                throw new Error('MediaPipe library not loaded');
            }

            this.selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                }
            });

            this.selfieSegmentation.setOptions({
                modelSelection: 1, // 0 for general model, 1 for landscape model
                selfieMode: false,
            });

            this.selfieSegmentation.onResults((results) => this.onSegmentationResults(results));
            
            this.hideLoading();
            this.showToast('AI model loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error initializing AI:', error);
            this.hideLoading();
            this.showToast('Failed to load AI model. Please refresh and try again.', 'error');
            throw error; // Re-throw to handle in calling function
        }
    }

    // File handling
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadImage(file);
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
        if (files.length > 0) {
            this.loadImage(files[0]);
        }
    }

    loadImage(file) {
        // Validate file type
        const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Please upload an image file with supported formats: JPG, JPEG, PNG, WebP, BMP, or GIF.', 'error');
            return;
        }

        // Check for specific unsupported formats
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            this.showToast('HEIC/HEIF format is not supported. Please convert to JPG, PNG, or WebP format.', 'error');
            return;
        }

        if (!supportedFormats.includes(file.type)) {
            this.showToast('Unsupported image format. Please upload JPG, JPEG, PNG, WebP, BMP, or GIF files only.', 'error');
            return;
        }

        // Validate file size
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
            this.showToast(`Image size is too large (${fileSizeMB}MB). Please upload an image smaller than 10MB.`, 'error');
            return;
        }

        // Reset all state for new image
        this.resetState();

        this.showLoading('Loading image...');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Validate image dimensions
                if (img.width < 10 || img.height < 10) {
                    this.hideLoading();
                    this.showToast('Image is too small. Please upload an image at least 10x10 pixels.', 'error');
                    return;
                }

                if (img.width > 4000 || img.height > 4000) {
                    this.hideLoading();
                    this.showToast('Image dimensions are too large. Please upload an image smaller than 4000x4000 pixels.', 'error');
                    return;
                }

                this.originalImage = img;
                this.displayOriginalImage();
                this.showProcessingSection();
                this.hideLoading();
                this.showToast('Image loaded successfully! Click "Remove Background" to start.', 'success');
            };
            img.onerror = () => {
                this.hideLoading();
                
                // Determine error type based on file properties
                let errorMessage = 'Failed to load image. ';
                
                if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                    errorMessage += 'HEIC/HEIF files are not supported by browsers. Please convert to JPG or PNG.';
                } else if (file.type && !file.type.startsWith('image/')) {
                    errorMessage += 'This is not a valid image file. Please upload JPG, PNG, WebP, BMP, or GIF files.';
                } else if (file.size === 0) {
                    errorMessage += 'The file appears to be empty or corrupted.';
                } else {
                    errorMessage += 'The image file may be corrupted or in an unsupported format. Please try a different image.';
                }
                
                this.showToast(errorMessage, 'error');
                console.error('Image load error - File:', file.name, 'Size:', file.size, 'Type:', file.type);
            };
            
            // Add crossOrigin for better compatibility
            img.crossOrigin = 'anonymous';
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            this.hideLoading();
            
            let errorMessage = 'Failed to read the file. ';
            if (file.size === 0) {
                errorMessage += 'The file appears to be empty.';
            } else if (file.size > 50 * 1024 * 1024) { // 50MB
                errorMessage += 'The file is too large to process.';
            } else {
                errorMessage += 'The file may be corrupted or inaccessible.';
            }
            
            this.showToast(errorMessage, 'error');
            console.error('FileReader error - File:', file.name, 'Size:', file.size, 'Type:', file.type);
        };
        
        reader.readAsDataURL(file);
    }

    displayOriginalImage() {
        this.originalImageEl.src = this.originalImage.src;
        
        // Setup result canvas dimensions
        const maxDimension = 800;
        let { width, height } = this.calculateDisplaySize(
            this.originalImage.width, 
            this.originalImage.height, 
            maxDimension, 
            maxDimension
        );
        
        this.resultCanvas.width = width;
        this.resultCanvas.height = height;
        this.resultCanvas.style.maxWidth = '100%';
        this.resultCanvas.style.height = 'auto';
    }

    calculateDisplaySize(originalWidth, originalHeight, maxWidth, maxHeight) {
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
        
        return { width: Math.round(width), height: Math.round(height) };
    }

    showProcessingSection() {
        this.uploadSection.style.display = 'none';
        this.processingSection.style.display = 'block';
    }

    // Background removal
    async removeBackground() {
        if (!this.originalImage || this.isProcessing) return;
        
        try {
            this.isProcessing = true;
            this.showProcessingOverlay();
            this.removeBgBtn.disabled = true;
            
            // Ensure AI model is initialized
            if (!this.selfieSegmentation) {
                await this.initializeAI();
            }
            
            // Create a temporary canvas to prepare the image for MediaPipe
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // Set reasonable dimensions for processing (MediaPipe works better with smaller images)
            const maxDimension = 512;
            const scale = Math.min(maxDimension / this.originalImage.width, maxDimension / this.originalImage.height);
            const processWidth = Math.floor(this.originalImage.width * scale);
            const processHeight = Math.floor(this.originalImage.height * scale);
            
            tempCanvas.width = processWidth;
            tempCanvas.height = processHeight;
            tempCtx.drawImage(this.originalImage, 0, 0, processWidth, processHeight);
            
            // Convert canvas to image for MediaPipe
            const processImage = new Image();
            processImage.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                processImage.onload = resolve;
                processImage.onerror = () => reject(new Error('Failed to process image'));
                processImage.src = tempCanvas.toDataURL();
            });
            
            // Send image to MediaPipe for segmentation
            await this.selfieSegmentation.send({ image: processImage });
            
        } catch (error) {
            console.error('Error removing background:', error);
            this.showToast('Error removing background. Please try again.', 'error');
            this.hideProcessingOverlay();
            this.isProcessing = false;
            this.removeBgBtn.disabled = false;
        }
    }

    onSegmentationResults(results) {
        try {
            const canvas = this.resultCanvas;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Get segmentation mask
            const segmentationMask = results.segmentationMask;
            
            // Create working canvas at original image size
            const workingCanvas = document.createElement('canvas');
            const workingCtx = workingCanvas.getContext('2d');
            workingCanvas.width = this.originalImage.width;
            workingCanvas.height = this.originalImage.height;
            
            // Draw original image
            workingCtx.drawImage(this.originalImage, 0, 0);
            
            // Get image data
            const imageData = workingCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
            const data = imageData.data;
            
            // Create mask canvas
            const maskCanvas = document.createElement('canvas');
            const maskCtx = maskCanvas.getContext('2d');
            maskCanvas.width = workingCanvas.width;
            maskCanvas.height = workingCanvas.height;
            maskCtx.drawImage(segmentationMask, 0, 0, maskCanvas.width, maskCanvas.height);
            
            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            const mask = maskData.data;
            
            // Apply mask to remove background
            for (let i = 0; i < data.length; i += 4) {
                const maskIndex = Math.floor(i / 4) * 4;
                const maskValue = mask[maskIndex]; // Use red channel of mask
                
                if (maskValue < 128) { // Background pixel
                    data[i + 3] = 0; // Make transparent
                }
            }
            
            // Apply edge smoothing
            if (this.edgeSmoothing > 0) {
                this.applyEdgeSmoothing(data, mask, workingCanvas.width, workingCanvas.height);
            }
            
            // Put processed image data back
            workingCtx.putImageData(imageData, 0, 0);
            
            // Draw to display canvas
            ctx.drawImage(workingCanvas, 0, 0, canvas.width, canvas.height);

            // Store the transparent foreground so applyBackground() can composite correctly
            this.transparentResultCanvas = document.createElement('canvas');
            this.transparentResultCanvas.width = canvas.width;
            this.transparentResultCanvas.height = canvas.height;
            this.transparentResultCanvas.getContext('2d').drawImage(canvas, 0, 0);

            // Apply selected background
            this.applyBackground();
            
            // Show result
            this.hideProcessingOverlay();
            this.downloadBtn.style.display = 'inline-flex';
            this.showToast('Background removed successfully!', 'success');
            
        } catch (error) {
            console.error('Error processing segmentation results:', error);
            this.showToast('Error processing image. Please try again.', 'error');
            this.hideProcessingOverlay();
        }
        
        this.isProcessing = false;
        this.removeBgBtn.disabled = false;
    }

    applyEdgeSmoothing(data, mask, width, height) {
        const smoothingRadius = this.edgeSmoothing;
        const smoothedAlpha = new Uint8ClampedArray(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const dataIndex = index * 4;
                
                if (data[dataIndex + 3] > 0) { // Foreground pixel
                    let alphaSum = 0;
                    let count = 0;
                    
                    // Sample surrounding pixels
                    for (let dy = -smoothingRadius; dy <= smoothingRadius; dy++) {
                        for (let dx = -smoothingRadius; dx <= smoothingRadius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIndex = ny * width + nx;
                                const nDataIndex = nIndex * 4;
                                alphaSum += data[nDataIndex + 3];
                                count++;
                            }
                        }
                    }
                    
                    smoothedAlpha[index] = alphaSum / count;
                } else {
                    smoothedAlpha[index] = 0;
                }
            }
        }
        
        // Apply smoothed alpha
        for (let i = 0; i < smoothedAlpha.length; i++) {
            data[i * 4 + 3] = smoothedAlpha[i];
        }
    }

    // Background options
    selectBackground(event) {
        this.backgroundOptions.forEach(opt => opt.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        this.currentBackground = event.currentTarget.dataset.bg;
        this.applyBackground();
    }

    applyBackground() {
        if (!this.transparentResultCanvas) return;

        const canvas = this.resultCanvas;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background color first (if not transparent)
        if (this.currentBackground !== 'transparent') {
            switch (this.currentBackground) {
                case 'white':
                    ctx.fillStyle = '#ffffff';
                    break;
                case 'black':
                    ctx.fillStyle = '#000000';
                    break;
                case 'custom':
                    ctx.fillStyle = this.customColorInput.value;
                    break;
            }
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw the transparent foreground on top
        ctx.drawImage(this.transparentResultCanvas, 0, 0);
    }

    // Download functionality
    downloadResult() {
        if (!this.resultCanvas) return;
        
        try {
            const link = document.createElement('a');
            const filename = `background-removed-${Date.now()}.png`;
            
            this.resultCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
                
                this.showToast('Image downloaded successfully!', 'success');
            }, 'image/png');
            
        } catch (error) {
            console.error('Download error:', error);
            this.showToast('Error downloading image.', 'error');
        }
    }

    // UI helpers
    resetToUpload() {
        this.originalImage = null;
        this.fileInput.value = '';
        this.uploadSection.style.display = 'block';
        this.processingSection.style.display = 'none';
        this.downloadBtn.style.display = 'none';
        this.removeBgBtn.disabled = false;
        
        // Reset controls
        this.backgroundOptions.forEach(opt => opt.classList.remove('active'));
        this.backgroundOptions[0].classList.add('active');
        this.currentBackground = 'transparent';
        this.edgeSmoothingSlider.value = 2;
        this.edgeSmoothing = 2;
        this.smoothingValue.textContent = '2';
    }

    showProcessingOverlay() {
        this.processingOverlay.style.display = 'flex';
    }

    hideProcessingOverlay() {
        this.processingOverlay.style.display = 'none';
    }

    showLoading(message = 'Processing...') {
        const loadingContent = this.loadingOverlay.querySelector('.loading-content p');
        if (loadingContent) {
            loadingContent.textContent = message;
        }
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BackgroundRemover();
});
