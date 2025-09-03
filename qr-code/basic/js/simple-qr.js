/**
 * Simple QR Code Implementation - Fallback when CDN libraries fail
 * Uses QR Server API as backup
 */

class SimpleQR {
    static async generateQRCode(text, options = {}) {
        const size = options.width || 300;
        const errorCorrection = options.errorCorrectionLevel || 'M';
        
        try {
            // Use QR Server API as fallback
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&ecc=${errorCorrection}`;
            
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // Convert image to canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = size;
                    canvas.height = size;
                    ctx.drawImage(img, 0, 0, size, size);
                    resolve(canvas);
                };
                img.onerror = () => {
                    reject(new Error('Failed to generate QR code'));
                };
                img.src = qrUrl;
            });
        } catch (error) {
            throw new Error('QR generation service unavailable');
        }
    }

    static async toCanvas(canvas, text, options = {}) {
        try {
            const qrCanvas = await this.generateQRCode(text, options);
            const ctx = canvas.getContext('2d');
            canvas.width = qrCanvas.width;
            canvas.height = qrCanvas.height;
            ctx.drawImage(qrCanvas, 0, 0);
            return canvas;
        } catch (error) {
            throw error;
        }
    }

    static async toString(text, options = {}) {
        if (options.type === 'svg') {
            const size = options.width || 300;
            // Simple SVG QR placeholder
            return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="white"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12">
                    QR: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}
                </text>
            </svg>`;
        }
        
        // For other types, use API
        const canvas = await this.generateQRCode(text, options);
        return canvas.toDataURL();
    }
}

// Make it available globally
window.SimpleQR = SimpleQR;
