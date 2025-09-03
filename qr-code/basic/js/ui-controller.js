/**
 * UI Controller - Manages UI state and user interactions
 * Handles QR generation with Make QR button functionality
 */

class UIController {
    constructor() {
        this.qrCore = new QRCore();
        this.currentTab = 'url';
        this.elements = {};
        
        this.init();
    }

    /**
     * Initialize UI Controller
     */
    init() {
        // Proceed if at least one QR library is available (QRCode or SimpleQR)
        if (typeof QRCode === 'undefined' && typeof SimpleQR === 'undefined') {
            console.error('No QR libraries available!');
            this.showNotification('QR libraries failed to load. Check your internet connection and try again.', 'error');
            return;
        }
        
        this.cacheElements();
        this.setupEventListeners();
        this.setupQRCallbacks();
        
        // Switch to default tab and update button state
        this.switchTab('url');
        this.showInitialState();
        
        console.log('UI Controller initialized successfully');
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Tab elements
            tabButtons: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Make QR buttons
            makeQRButtons: document.querySelectorAll('.make-qr-btn'),
            
            // Input elements for each type
            urlInput: document.getElementById('url-input'),
            textInput: document.getElementById('text-input'),
            emailAddress: document.getElementById('email-address'),
            emailSubject: document.getElementById('email-subject'),
            emailBody: document.getElementById('email-body'),
            phoneInput: document.getElementById('phone-input'),
            smsPhone: document.getElementById('sms-phone'),
            smsMessage: document.getElementById('sms-message'),
            
            // WiFi elements
            wifiSSID: document.getElementById('wifi-ssid'),
            wifiPassword: document.getElementById('wifi-password'),
            wifiSecurity: document.getElementById('wifi-security'),
            wifiHidden: document.getElementById('wifi-hidden'),
            showPassword: document.getElementById('show-password'),
            
            // Options
            sizeSelect: document.getElementById('size-select'),
            errorCorrectionSelect: document.getElementById('error-correction'),
            
            // Preview and download
            qrContainer: document.getElementById('qr-code-display'),
            downloadButtons: {
                png: document.getElementById('download-png'),
                svg: document.getElementById('download-svg'),
                pdf: document.getElementById('download-pdf')
            }
        };
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Tab switching
        this.elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Tab clicked:', e.target.dataset.tab); // Debug log
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Make QR button listeners
        this.elements.makeQRButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const qrType = e.target.dataset.type;
                console.log('Make QR clicked:', qrType); // Debug log
                this.handleMakeQR(qrType, e.target);
            });
        });

        // Input listeners for validation and button state
        this.setupInputListeners();
        
        // Options listeners
        this.elements.sizeSelect?.addEventListener('change', () => {
            this.updateQROptions();
        });
        
        this.elements.errorCorrectionSelect?.addEventListener('change', () => {
            this.updateQROptions();
        });

        // Download listeners
        Object.entries(this.elements.downloadButtons).forEach(([format, btn]) => {
            btn?.addEventListener('click', () => this.downloadQR(format));
        });

        // WiFi password visibility toggle
        this.elements.showPassword?.addEventListener('change', (e) => {
            if (this.elements.wifiPassword) {
                this.elements.wifiPassword.type = e.target.checked ? 'text' : 'password';
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Setup input listeners for validation and button state updates
     */
    setupInputListeners() {
        const inputConfigs = [
            { element: this.elements.urlInput, type: 'url' },
            { element: this.elements.textInput, type: 'text' },
            { element: this.elements.emailAddress, type: 'email' },
            { element: this.elements.emailSubject, type: 'email' },
            { element: this.elements.emailBody, type: 'email' },
            { element: this.elements.phoneInput, type: 'phone' },
            { element: this.elements.smsPhone, type: 'sms' },
            { element: this.elements.smsMessage, type: 'sms' },
            { element: this.elements.wifiSSID, type: 'wifi' },
            { element: this.elements.wifiPassword, type: 'wifi' }
        ];

        inputConfigs.forEach(config => {
            if (config.element) {
                // Validate on blur
                config.element.addEventListener('blur', () => {
                    this.validateInput(config.element, config.type);
                });
                
                // Update Make QR button state on input
                config.element.addEventListener('input', () => {
                    this.updateMakeQRButtonState();
                });
            }
        });
    }

    /**
     * Setup QR Core callbacks
     */
    setupQRCallbacks() {
        this.qrCore.onQRGenerated = (type, data) => {
            this.onQRGenerated(type, data);
        };
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        console.log('Switching to tab:', tabName); // Debug log
        
        // Update tab buttons
        this.elements.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        this.elements.tabContents.forEach(content => {
            const contentId = `${tabName}-tab`;
            content.classList.toggle('active', content.id === contentId);
        });

        this.currentTab = tabName;
        
        // Update Make QR button state for new tab
        this.updateMakeQRButtonState();
    }

    /**
     * Handle Make QR button click
     */
    async handleMakeQR(type, button) {
        // Show loading state
        this.setButtonState(button, 'loading');
        
        try {
            // Collect data for the specific type
            const data = this.collectDataForType(type);
            
            if (!data) {
                throw new Error('Please fill in the required fields');
            }
            
            // Generate QR code
            const success = await this.qrCore.generateQR(data, type, this.elements.qrContainer);
            
            if (success) {
                // Show success state
                this.setButtonState(button, 'success');
                this.updateDownloadButtons(true);
                this.showNotification('QR code generated successfully!', 'success');
                
                // Reset button state after 2 seconds
                setTimeout(() => {
                    this.setButtonState(button, 'normal');
                }, 2000);
                
            } else {
                throw new Error('Failed to generate QR code');
            }
            
        } catch (error) {
            // Show error state
            this.setButtonState(button, 'error');
            this.showNotification(error.message, 'error');
            
            // Reset button state after 2 seconds
            setTimeout(() => {
                this.setButtonState(button, 'normal');
            }, 2000);
        }
    }

    /**
     * Set button visual state
     */
    setButtonState(button, state) {
        button.classList.remove('loading', 'success', 'error');
        
        switch (state) {
            case 'loading':
                button.classList.add('loading');
                button.innerHTML = '<span>Make QR</span>';
                break;
            case 'success':
                button.classList.add('success');
                button.innerHTML = '✓ Generated!';
                break;
            case 'error':
                button.classList.add('error');
                button.innerHTML = '✗ Error';
                break;
            case 'normal':
            default:
                button.innerHTML = 'Make QR';
                break;
        }
    }

    /**
     * Update Make QR button state based on input validation
     */
    updateMakeQRButtonState() {
        const currentButton = document.querySelector(`.make-qr-btn[data-type="${this.currentTab}"]`);
        if (!currentButton) return;
        
        const hasValidData = this.hasValidDataForCurrentTab();
        currentButton.disabled = !hasValidData;
    }

    /**
     * Check if current tab has valid data
     */
    hasValidDataForCurrentTab() {
        const data = this.collectDataForType(this.currentTab);
        return data !== null && data !== '';
    }

    /**
     * Collect data for specific QR type
     */
    collectDataForType(type) {
        switch (type) {
            case 'url':
                return this.elements.urlInput?.value.trim() || null;
            
            case 'wifi':
                const ssid = this.elements.wifiSSID?.value.trim();
                if (!ssid) return null;
                
                const password = this.elements.wifiPassword?.value || '';
                const security = this.elements.wifiSecurity?.value || 'WPA';
                const hidden = this.elements.wifiHidden?.checked || false;
                
                return {
                    ssid,
                    password,
                    security,
                    hidden
                };
            
            case 'text':
                return this.elements.textInput?.value.trim() || null;
            
            case 'email':
                const email = this.elements.emailAddress?.value.trim();
                if (!email) return null;
                
                return {
                    email,
                    subject: this.elements.emailSubject?.value.trim() || '',
                    body: this.elements.emailBody?.value.trim() || ''
                };
            
            case 'phone':
                return this.elements.phoneInput?.value.trim() || null;
            
            case 'sms':
                const phone = this.elements.smsPhone?.value.trim();
                if (!phone) return null;
                
                return {
                    phone,
                    message: this.elements.smsMessage?.value.trim() || ''
                };
            
            default:
                return null;
        }
    }

    /**
     * Update QR options and regenerate if QR exists
     */
    updateQROptions() {
        const size = parseInt(this.elements.sizeSelect?.value || 300);
        const errorCorrection = this.elements.errorCorrectionSelect?.value || 'M';
        
        this.qrCore.updateOptions({
            width: size,
            height: size,
            errorCorrectionLevel: errorCorrection
        });
    }

    /**
     * Validate input based on type
     */
    validateInput(element, type) {
        if (!element) return;

        const value = element.value.trim();
        element.classList.remove('error', 'success');

        // Remove existing error messages
        const existingError = element.parentNode.querySelector('.error-message');
        if (existingError) existingError.remove();

        if (!value) return; // Empty is okay

        let isValid = true;
        let errorMessage = '';

        switch (type) {
            case 'url':
                isValid = this.isValidURL(value);
                errorMessage = 'Please enter a valid URL';
                break;
            
            case 'email':
                if (element === this.elements.emailAddress) {
                    isValid = this.qrCore.isValidEmail(value);
                    errorMessage = 'Please enter a valid email address';
                }
                break;
            
            case 'phone':
            case 'sms':
                if (element.type === 'tel' || element.id.includes('phone')) {
                    isValid = this.isValidPhone(value);
                    errorMessage = 'Please enter a valid phone number';
                }
                break;
        }

        if (!isValid) {
            element.classList.add('error');
            this.showError(element, errorMessage);
        } else if (value) {
            element.classList.add('success');
        }
    }

    /**
     * Show error message for input
     */
    showError(element, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        element.parentNode.appendChild(errorDiv);
    }

    /**
     * Download QR code
     */
    async downloadQR(format) {
        const success = await this.qrCore.download(format);
        if (success) {
            this.showNotification(`QR code downloaded as ${format.toUpperCase()}`, 'success');
        } else {
            this.showNotification('Download failed. Please try again.', 'error');
        }
    }

    /**
     * Update download button states
     */
    updateDownloadButtons(hasQR) {
        Object.values(this.elements.downloadButtons).forEach(btn => {
            if (btn) btn.disabled = !hasQR;
        });
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to generate QR
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const currentButton = document.querySelector(`.make-qr-btn[data-type="${this.currentTab}"]`);
            if (currentButton && !currentButton.disabled) {
                currentButton.click();
            }
        }

        // Tab navigation with numbers
        if (e.ctrlKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const tabs = ['url', 'wifi', 'text', 'email', 'phone', 'sms'];
            const tabIndex = parseInt(e.key) - 1;
            if (tabs[tabIndex]) {
                this.switchTab(tabs[tabIndex]);
            }
        }
    }

    /**
     * Show initial state
     */
    showInitialState() {
        this.qrCore.showEmptyState(this.elements.qrContainer);
        this.updateDownloadButtons(false);
        this.updateMakeQRButtonState();
    }

    /**
     * Callback when QR is generated
     */
    onQRGenerated(type, data) {
        console.log(`QR generated: ${type}`, data);
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007acc'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Utility methods
     */
    isValidURL(url) {
        try {
            new URL(url.startsWith('http') ? url : 'https://' + url);
            return true;
        } catch {
            return false;
        }
    }

    isValidPhone(phone) {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10;
    }
}

// Initialize when DOM is ready and QRCode library is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing UI Controller...');
    window.uiController = new UIController();
});

// Also try to initialize after a delay as fallback
setTimeout(() => {
    if (typeof window.uiController === 'undefined') {
        console.log('Fallback initialization attempt...');
        if (typeof QRCode !== 'undefined' || typeof SimpleQR !== 'undefined') {
            window.uiController = new UIController();
        } else {
            console.error('QR libraries failed to load after timeout');
            // Ensure document.body exists before using it
            if (document.body) {
                document.body.insertAdjacentHTML('afterbegin', `
                    <div style="background: #dc3545; color: white; padding: 10px; text-align: center; font-size: 14px;">
                        ⚠️ QR libraries failed to load. Please check your internet connection and refresh the page.
                    </div>
                `);
            }
        }
    }
}, 3000);

// Export for testing
window.UIController = UIController;