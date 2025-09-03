/**
 * QR Core - Main QR Code Generation Engine
 * Focused on 5 core features: URL, Text, Email, Phone, SMS
 */

class QRCore {
    constructor() {
        this.currentQR = null;
        this.currentData = '';
        this.currentType = 'url';
        this.options = {
            width: 300,
            height: 300,
            errorCorrectionLevel: 'M',
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        };
    }

    /**
     * Generate QR Code for the 5 basic types
     * @param {string} data - The data to encode
     * @param {string} type - url|text|email|phone|sms
     * @param {HTMLElement} container - Container to render QR
     */
    async generateQR(data, type, container) {
        if (!data || !container) {
            this.showEmptyState(container);
            return false;
        }

        try {
            // Validate data based on type
            const validatedData = this.validateAndFormat(data, type);
            if (!validatedData) {
                throw new Error('Invalid data format');
            }

            // Clear previous QR
            container.innerHTML = '';

            // Show loading state
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Generating QR code...</p>
                </div>
            `;

            // Try primary QR library first, then fallback
            let canvas;
            if (typeof QRCode !== 'undefined') {
                console.log('Using QRCode library');
                canvas = document.createElement('canvas');
                await QRCode.toCanvas(canvas, validatedData, this.options);
            } else if (typeof SimpleQR !== 'undefined') {
                console.log('Using SimpleQR fallback');
                canvas = document.createElement('canvas');
                await SimpleQR.toCanvas(canvas, validatedData, this.options);
            } else {
                throw new Error('No QR code library available');
            }
            
            // Clear loading and show QR
            container.innerHTML = '';
            container.appendChild(canvas);
            
            // Store current QR data
            this.currentQR = canvas;
            this.currentData = validatedData;
            this.currentType = type;

            // Trigger success callback
            this.onQRGenerated?.(type, validatedData);
            
            return true;

        } catch (error) {
            console.error('QR Generation failed:', error);
            this.showErrorState(container, error.message);
            return false;
        }
    }

    /**
     * Validate and format data for each QR type
     */
    validateAndFormat(data, type) {
        switch (type) {
            case 'url':
                return this.formatURL(data);
            
            case 'wifi':
                return this.formatWiFi(data);
            
            case 'text':
                return this.formatText(data);
            
            case 'email':
                return this.formatEmail(data);
            
            case 'phone':
                return this.formatPhone(data);
            
            case 'sms':
                return this.formatSMS(data);
            
            default:
                return null;
        }
    }

    /**
     * URL Formatter
     */
    formatURL(url) {
        if (!url) return null;
        
        // Add protocol if missing
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        
        // Basic URL validation
        try {
            new URL(url);
            return url;
        } catch {
            return null;
        }
    }

    /**
     * Text Formatter
     */
    formatText(text) {
        if (!text || text.length > 4296) return null;
        return text.trim();
    }

    /**
     * WiFi Formatter
     */
    formatWiFi(wifiData) {
        const { ssid, password, security, hidden } = wifiData;
        
        if (!ssid) return null;
        
        // WiFi QR format: WIFI:T:WPA;S:MySSID;P:MyPassword;H:false;;
        let wifi = `WIFI:T:${security};S:${ssid};`;
        if (password && security !== 'nopass') {
            wifi += `P:${password};`;
        }
        wifi += `H:${hidden ? 'true' : 'false'};;`;
        
        return wifi;
    }

    /**
     * Email Formatter
     */
    formatEmail(emailData) {
        const { email, subject = '', body = '' } = emailData;
        
        if (!email || !this.isValidEmail(email)) return null;
        
        let mailto = `mailto:${email}`;
        const params = [];
        
        if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
        if (body) params.push(`body=${encodeURIComponent(body)}`);
        
        if (params.length > 0) {
            mailto += '?' + params.join('&');
        }
        
        return mailto;
    }

    /**
     * Phone Formatter
     */
    formatPhone(phone) {
        if (!phone) return null;
        
        // Remove all non-digit characters except +
        const cleaned = phone.replace(/[^\d+]/g, '');
        
        if (cleaned.length < 10) return null;
        
        return `tel:${cleaned}`;
    }

    /**
     * SMS Formatter
     */
    formatSMS(smsData) {
        const { phone, message = '' } = smsData;
        
        if (!phone) return null;
        
        const cleanedPhone = phone.replace(/[^\d+]/g, '');
        if (cleanedPhone.length < 10) return null;
        
        let sms = `sms:${cleanedPhone}`;
        if (message) {
            sms += `?body=${encodeURIComponent(message)}`;
        }
        
        return sms;
    }

    /**
     * Update QR options (size, error correction, etc.)
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // Regenerate current QR if exists
        if (this.currentData && this.currentQR) {
            const container = this.currentQR.parentElement;
            this.generateQR(this.currentData, this.currentType, container);
        }
    }

    /**
     * Download current QR code
     */
    async download(format = 'png', filename = null) {
        if (!this.currentQR || !this.currentData) return false;

        const name = filename || `qr-${this.currentType}-${Date.now()}`;

        try {
            switch (format.toLowerCase()) {
                case 'png':
                    this.downloadPNG(name);
                    break;
                case 'svg':
                    await this.downloadSVG(name);
                    break;
                case 'pdf':
                    this.downloadPDF(name);
                    break;
                default:
                    throw new Error('Unsupported format');
            }
            return true;
        } catch (error) {
            console.error('Download failed:', error);
            return false;
        }
    }

    /**
     * Download as PNG
     */
    downloadPNG(filename) {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = this.currentQR.toDataURL('image/png');
        link.click();
    }

    /**
     * Download as SVG
     */
    async downloadSVG(filename) {
        try {
            let svg;
            if (typeof QRCode !== 'undefined') {
                svg = await QRCode.toString(this.currentData, {
                    ...this.options,
                    type: 'svg'
                });
            } else if (typeof SimpleQR !== 'undefined') {
                svg = await SimpleQR.toString(this.currentData, {
                    ...this.options,
                    type: 'svg'
                });
            } else {
                throw new Error('No QR library available for SVG generation');
            }
            
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = `${filename}.svg`;
            link.href = url;
            link.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('SVG download failed:', error);
            // Fallback to PNG
            this.downloadPNG(filename.replace('.svg', '.png'));
        }
    }

    /**
     * Download as PDF (simple implementation)
     */
    downloadPDF(filename) {
        // For now, download as high-res PNG
        // TODO: Implement proper PDF generation with jsPDF
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = this.currentQR.toDataURL('image/png');
        link.click();
    }

    /**
     * Utility Methods
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📱</div>
                <p>Enter data to generate QR code</p>
            </div>
        `;
    }

    showErrorState(container, message) {
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <p>Error: ${message}</p>
            </div>
        `;
    }

    /**
     * Get QR code as data URL for preview
     */
    getDataURL() {
        return this.currentQR ? this.currentQR.toDataURL() : null;
    }

    /**
     * Get current QR data
     */
    getCurrentData() {
        return {
            data: this.currentData,
            type: this.currentType,
            options: this.options
        };
    }
}

// Export for use in other modules
window.QRCore = QRCore;
