// QR Code Generator Core Functionality
class QRGenerator {
    constructor() {
        this.currentQRCode = null;
        this.currentData = '';
        this.currentOptions = {
            width: 300,
            height: 300,
            errorCorrectionLevel: 'M',
            margin: 1
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateQRCodeOptions();
        // Generate initial QR code with placeholder
        this.generateQRCode('https://toolzzhub.com', 'url');
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Input field listeners
        const inputs = [
            { id: 'url-input', type: 'url' },
            { id: 'wifi-ssid', type: 'wifi' },
            { id: 'wifi-password', type: 'wifi' },
            { id: 'wifi-security', type: 'wifi' },
            { id: 'wifi-hidden', type: 'wifi' },
            { id: 'text-input', type: 'text' },
            { id: 'email-address', type: 'email' },
            { id: 'email-subject', type: 'email' },
            { id: 'email-body', type: 'email' },
            { id: 'phone-input', type: 'phone' },
            { id: 'sms-phone', type: 'sms' },
            { id: 'sms-message', type: 'sms' }
        ];

        inputs.forEach(input => {
            const element = document.getElementById(input.id);
            if (element) {
                element.addEventListener('input', () => this.handleInputChange(input.type));
                element.addEventListener('blur', () => this.validateInput(input.id, input.type));
                
                // Special handling for WiFi password visibility
                if (input.id === 'wifi-password') {
                    const showPasswordCheckbox = document.getElementById('show-password');
                    if (showPasswordCheckbox) {
                        showPasswordCheckbox.addEventListener('change', () => {
                            element.type = showPasswordCheckbox.checked ? 'text' : 'password';
                        });
                    }
                }
            }
        });

        // Options listeners
        document.getElementById('size-select').addEventListener('change', () => {
            this.updateQRCodeOptions();
            this.regenerateCurrentQR();
        });

        document.getElementById('error-correction').addEventListener('change', () => {
            this.updateQRCodeOptions();
            this.regenerateCurrentQR();
        });

        // Download listeners
        document.getElementById('download-png').addEventListener('click', () => this.downloadQR('png'));
        document.getElementById('download-svg').addEventListener('click', () => this.downloadQR('svg'));
        document.getElementById('download-pdf').addEventListener('click', () => this.downloadQR('pdf'));
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Generate QR code for current tab
        this.handleInputChange(tabName);
    }

    handleInputChange(type) {
        const data = this.collectInputData(type);
        if (data) {
            this.generateQRCode(data, type);
        }
    }

    collectInputData(type) {
        switch (type) {
            case 'url':
                return document.getElementById('url-input').value.trim();
            
            case 'wifi':
                const ssid = document.getElementById('wifi-ssid').value.trim();
                const password = document.getElementById('wifi-password').value;
                const security = document.getElementById('wifi-security').value;
                const hidden = document.getElementById('wifi-hidden').checked;
                
                if (!ssid) return '';
                
                // WiFi QR format: WIFI:T:WPA;S:MySSID;P:MyPassword;H:false;;
                let wifi = `WIFI:T:${security};S:${ssid};`;
                if (password && security !== 'nopass') {
                    wifi += `P:${password};`;
                }
                wifi += `H:${hidden ? 'true' : 'false'};;`;
                return wifi;
            
            case 'text':
                return document.getElementById('text-input').value.trim();
            
            case 'email':
                const email = document.getElementById('email-address').value.trim();
                const subject = document.getElementById('email-subject').value.trim();
                const body = document.getElementById('email-body').value.trim();
                
                if (!email) return '';
                
                let mailto = `mailto:${email}`;
                const params = [];
                if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                
                if (params.length > 0) {
                    mailto += '?' + params.join('&');
                }
                return mailto;
            
            case 'phone':
                const phone = document.getElementById('phone-input').value.trim();
                return phone ? `tel:${phone}` : '';
            
            case 'sms':
                const smsPhone = document.getElementById('sms-phone').value.trim();
                const smsMessage = document.getElementById('sms-message').value.trim();
                
                if (!smsPhone) return '';
                
                let sms = `sms:${smsPhone}`;
                if (smsMessage) {
                    sms += `?body=${encodeURIComponent(smsMessage)}`;
                }
                return sms;
            
            default:
                return '';
        }
    }

    validateInput(inputId, type) {
        const input = document.getElementById(inputId);
        const value = input.value.trim();
        
        // Remove previous validation classes
        input.classList.remove('error', 'success');
        
        // Remove existing error messages
        const existingError = input.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        if (!value) return true; // Empty is okay

        let isValid = true;
        let errorMessage = '';

        switch (type) {
            case 'url':
                const urlPattern = /^https?:\/\/.+/;
                isValid = urlPattern.test(value);
                errorMessage = 'Please enter a valid URL starting with http:// or https://';
                break;
            
            case 'email':
                if (inputId === 'email-address') {
                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    isValid = emailPattern.test(value);
                    errorMessage = 'Please enter a valid email address';
                }
                break;
            
            case 'phone':
            case 'sms':
                if (inputId.includes('phone')) {
                    const phonePattern = /^\+?[\d\s\-\(\)]+$/;
                    isValid = phonePattern.test(value) && value.length >= 10;
                    errorMessage = 'Please enter a valid phone number';
                }
                break;
        }

        if (!isValid) {
            input.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errorMessage;
            input.parentNode.appendChild(errorDiv);
        } else if (value) {
            input.classList.add('success');
        }

        return isValid;
    }

    updateQRCodeOptions() {
        const size = parseInt(document.getElementById('size-select').value);
        const errorCorrection = document.getElementById('error-correction').value;
        
        this.currentOptions = {
            width: size,
            height: size,
            errorCorrectionLevel: errorCorrection,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        };
    }

    async generateQRCode(data, type) {
        if (!data) {
            this.showEmptyState();
            return;
        }

        this.currentData = data;
        const container = document.getElementById('qr-code-display');
        
        try {
            // Clear previous QR code
            container.innerHTML = '';
            
            // Generate new QR code
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, data, this.currentOptions);
            
            container.appendChild(canvas);
            this.currentQRCode = canvas;
            
            // Enable download buttons
            this.enableDownloadButtons();
            
            // Hide help text
            const helpText = document.querySelector('.preview-help');
            if (helpText) helpText.style.display = 'none';
            
        } catch (error) {
            console.error('QR Code generation failed:', error);
            this.showErrorState('Failed to generate QR code. Please check your input.');
        }
    }

    regenerateCurrentQR() {
        if (this.currentData) {
            this.generateQRCode(this.currentData, 'current');
        }
    }

    showEmptyState() {
        const container = document.getElementById('qr-code-display');
        container.innerHTML = '';
        
        const helpText = document.querySelector('.preview-help');
        if (helpText) {
            helpText.style.display = 'block';
            helpText.textContent = 'QR code will appear here as you type';
        }
        
        this.disableDownloadButtons();
    }

    showErrorState(message) {
        const container = document.getElementById('qr-code-display');
        container.innerHTML = `<p style="color: #dc3545; font-size: 14px;">${message}</p>`;
        
        this.disableDownloadButtons();
    }

    enableDownloadButtons() {
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.disabled = false;
        });
    }

    disableDownloadButtons() {
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    async downloadQR(format) {
        if (!this.currentQRCode || !this.currentData) return;

        const filename = `qrcode_${Date.now()}`;
        
        try {
            switch (format) {
                case 'png':
                    this.downloadCanvas(this.currentQRCode, `${filename}.png`);
                    break;
                
                case 'svg':
                    const svg = await QRCode.toString(this.currentData, {
                        ...this.currentOptions,
                        type: 'svg'
                    });
                    this.downloadSVG(svg, `${filename}.svg`);
                    break;
                
                case 'pdf':
                    this.downloadPDF(this.currentQRCode, `${filename}.pdf`);
                    break;
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        }
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    downloadSVG(svgString, filename) {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    downloadPDF(canvas, filename) {
        // Simple PDF generation - you might want to use a library like jsPDF for better results
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename.replace('.pdf', '.png'); // Fallback to PNG for now
        link.href = imgData;
        link.click();
    }
}

// Initialize the QR Generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.qrGenerator = new QRGenerator();
});
