// Input Handlers and Utilities for QR Generator

class InputHandlers {
    static formatPhoneNumber(input) {
        // Remove all non-digit characters except +
        let value = input.value.replace(/[^\d+]/g, '');
        
        // Ensure + is only at the beginning
        if (value.includes('+') && !value.startsWith('+')) {
            value = value.replace(/\+/g, '');
        }
        
        // Format based on length
        if (value.startsWith('+1') && value.length > 2) {
            // US format: +1 (XXX) XXX-XXXX
            const number = value.slice(2);
            if (number.length >= 6) {
                value = `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6, 10)}`;
            } else if (number.length >= 3) {
                value = `+1 (${number.slice(0, 3)}) ${number.slice(3)}`;
            } else {
                value = `+1 ${number}`;
            }
        }
        
        input.value = value;
    }

    static validateURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    static validateEmail(email) {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    }

    static validatePhone(phone) {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        // Should have at least 10 digits
        return digits.length >= 10;
    }

    static addURLProtocol(url) {
        if (!url) return '';
        if (!/^https?:\/\//i.test(url)) {
            return 'https://' + url;
        }
        return url;
    }

    static limitTextLength(textarea, maxLength = 4296) {
        if (textarea.value.length > maxLength) {
            textarea.value = textarea.value.substring(0, maxLength);
        }
        
        // Update character counter if it exists
        const counter = textarea.parentNode.querySelector('.char-counter');
        if (counter) {
            counter.textContent = `${textarea.value.length}/${maxLength}`;
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static showTooltip(element, message, type = 'info') {
        // Remove existing tooltip
        const existingTooltip = document.querySelector('.input-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        const tooltip = document.createElement('div');
        tooltip.className = `input-tooltip tooltip-${type}`;
        tooltip.textContent = message;
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.position = 'absolute';
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.zIndex = '1000';
        tooltip.style.background = type === 'error' ? '#dc3545' : '#007acc';
        tooltip.style.color = 'white';
        tooltip.style.padding = '8px 12px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '12px';
        tooltip.style.maxWidth = '250px';
        tooltip.style.wordWrap = 'break-word';

        document.body.appendChild(tooltip);

        // Auto-remove tooltip after 3 seconds
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
    }
}

// Enhanced input event handlers
document.addEventListener('DOMContentLoaded', () => {
    // URL input enhancements
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
        urlInput.addEventListener('blur', () => {
            if (urlInput.value && !InputHandlers.validateURL(urlInput.value)) {
                urlInput.value = InputHandlers.addURLProtocol(urlInput.value);
            }
        });

        urlInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                if (urlInput.value && !InputHandlers.validateURL(urlInput.value)) {
                    urlInput.value = InputHandlers.addURLProtocol(urlInput.value);
                    urlInput.dispatchEvent(new Event('input'));
                }
            }, 100);
        });
    }

    // Phone number formatting
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', () => {
            InputHandlers.formatPhoneNumber(input);
        });
    });

    // Text area character limiting
    const textAreas = document.querySelectorAll('textarea');
    textAreas.forEach(textarea => {
        // Add character counter
        if (!textarea.parentNode.querySelector('.char-counter')) {
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.style.fontSize = '12px';
            counter.style.color = '#666';
            counter.style.textAlign = 'right';
            counter.style.marginTop = '5px';
            counter.textContent = `0/4296`;
            textarea.parentNode.appendChild(counter);
        }

        textarea.addEventListener('input', () => {
            InputHandlers.limitTextLength(textarea);
        });
    });

    // Email validation enhancements
    const emailInput = document.getElementById('email-address');
    if (emailInput) {
        emailInput.addEventListener('input', InputHandlers.debounce(() => {
            if (emailInput.value && !InputHandlers.validateEmail(emailInput.value)) {
                emailInput.classList.add('error');
            } else {
                emailInput.classList.remove('error');
            }
        }, 500));
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to download PNG
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const downloadBtn = document.getElementById('download-png');
            if (downloadBtn && !downloadBtn.disabled) {
                downloadBtn.click();
            }
        }

        // Escape to clear current input
        if (e.key === 'Escape') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.value = '';
                activeElement.dispatchEvent(new Event('input'));
            }
        }
    });

    // Copy to clipboard functionality
    const addCopyButton = (container) => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '📋 Copy QR Data';
        copyBtn.style.marginTop = '10px';
        copyBtn.style.padding = '8px 16px';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '6px';
        copyBtn.style.background = '#f8f9fa';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.fontSize = '12px';

        copyBtn.addEventListener('click', () => {
            if (window.qrGenerator && window.qrGenerator.currentData) {
                navigator.clipboard.writeText(window.qrGenerator.currentData).then(() => {
                    copyBtn.innerHTML = '✅ Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋 Copy QR Data';
                    }, 2000);
                });
            }
        });

        container.appendChild(copyBtn);
    };

    // Add copy button to download section
    const downloadSection = document.querySelector('.download-section');
    if (downloadSection) {
        addCopyButton(downloadSection);
    }

    // Help tooltips
    const addHelpTooltips = () => {
        const helpData = {
            'url-input': 'Enter any website URL. We\'ll automatically add https:// if needed.',
            'text-input': 'Enter any text up to 4,296 characters. Perfect for messages, quotes, or information.',
            'email-address': 'When scanned, this will open the default email app with a new message.',
            'phone-input': 'When scanned, this will offer to call the number directly.',
            'sms-phone': 'When scanned, this will open messaging app with pre-filled number and message.'
        };

        Object.entries(helpData).forEach(([id, message]) => {
            const element = document.getElementById(id);
            if (element) {
                const helpIcon = document.createElement('span');
                helpIcon.innerHTML = ' ℹ️';
                helpIcon.style.cursor = 'help';
                helpIcon.style.fontSize = '14px';
                helpIcon.addEventListener('click', () => {
                    InputHandlers.showTooltip(element, message, 'info');
                });

                const label = element.parentNode.querySelector('label');
                if (label) {
                    label.appendChild(helpIcon);
                }
            }
        });
    };

    addHelpTooltips();
});
