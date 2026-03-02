'use strict';

class AudioConverter {
    constructor() {
        this.audioFile = null;
        this.audioBuffer = null;
        this.outputBlob = null;
        this.audioCtx = null;

        this.uploadArea   = document.getElementById('upload-area');
        this.fileInput    = document.getElementById('file-input');
        this.browseBtn    = document.getElementById('browse-btn');
        this.uploadSection     = document.getElementById('upload-section');
        this.conversionSection = document.getElementById('conversion-section');
        this.changeFileBtn     = document.getElementById('change-file-btn');
        this.audioPreview      = document.getElementById('audio-preview');
        this.fileNameEl        = document.getElementById('file-name');
        this.fileSizeEl        = document.getElementById('file-size');
        this.outputFormat      = document.getElementById('output-format');
        this.mp3BitrateGroup   = document.getElementById('mp3-quality-group');
        this.mp3Bitrate        = document.getElementById('mp3-bitrate');
        this.convertBtn        = document.getElementById('convert-btn');
        this.progressSection   = document.getElementById('progress-section');
        this.progressText      = document.getElementById('progress-text');
        this.progressPct       = document.getElementById('progress-pct');
        this.progressBar       = document.getElementById('progress-bar');
        this.downloadSection   = document.getElementById('download-section');
        this.resultLabel       = document.getElementById('result-label');
        this.resultSize        = document.getElementById('result-size');
        this.downloadBtn       = document.getElementById('download-btn');

        this.bindEvents();
    }

    bindEvents() {
        this.browseBtn.addEventListener('click', (e) => { e.stopPropagation(); this.fileInput.click(); });
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        this.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); this.uploadArea.classList.add('drag-over'); });
        this.uploadArea.addEventListener('dragleave', () => this.uploadArea.classList.remove('drag-over'));
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
        });

        this.changeFileBtn.addEventListener('click', () => this.reset());
        this.convertBtn.addEventListener('click', () => this.convert());
        this.downloadBtn.addEventListener('click', () => this.download());

        this.outputFormat.addEventListener('change', () => {
            this.mp3BitrateGroup.style.display = this.outputFormat.value === 'mp3' ? '' : 'none';
            this.hideResult();
        });
    }

    handleFile(file) {
        if (!file) return;
        if (!file.type.startsWith('audio/') && !this.isAudioByExtension(file.name)) {
            alert('Please select a valid audio file (MP3, WAV, OGG, AAC, M4A, FLAC, WebM).');
            return;
        }
        const maxBytes = 200 * 1024 * 1024;
        if (file.size > maxBytes) {
            alert('File is too large. Maximum size is 200MB.');
            return;
        }
        this.audioFile = file;
        this.fileNameEl.textContent = file.name;
        this.fileSizeEl.textContent = this.formatSize(file.size);
        this.audioPreview.src = URL.createObjectURL(file);
        this.uploadSection.style.display = 'none';
        this.conversionSection.style.display = 'flex';
        this.hideResult();
    }

    isAudioByExtension(name) {
        return /\.(mp3|wav|ogg|aac|m4a|flac|webm|opus|wma|aiff|aif)$/i.test(name);
    }

    reset() {
        this.audioFile = null;
        this.audioBuffer = null;
        this.outputBlob = null;
        this.fileInput.value = '';
        if (this.audioPreview.src) {
            URL.revokeObjectURL(this.audioPreview.src);
            this.audioPreview.src = '';
        }
        this.uploadSection.style.display = '';
        this.conversionSection.style.display = 'none';
        this.hideResult();
        this.hideProgress();
    }

    hideResult() {
        this.downloadSection.style.display = 'none';
        this.outputBlob = null;
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
        this.setProgress(0, 'Converting...');
    }

    setProgress(pct, label) {
        this.progressBar.style.width = pct + '%';
        this.progressPct.textContent = pct + '%';
        if (label) this.progressText.textContent = label;
    }

    async convert() {
        if (!this.audioFile) return;

        const format = this.outputFormat.value;
        this.convertBtn.disabled = true;
        this.hideResult();
        this.progressSection.style.display = 'block';
        this.setProgress(5, 'Decoding audio...');

        try {
            // Decode audio using Web Audio API
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const arrayBuffer = await this.audioFile.arrayBuffer();
            this.setProgress(20, 'Decoding audio...');
            this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.setProgress(40, 'Encoding output...');

            let blob;
            if (format === 'wav') {
                blob = this.encodeWAV(this.audioBuffer);
                this.setProgress(90, 'Finalising...');
            } else if (format === 'mp3') {
                blob = await this.encodeMP3(this.audioBuffer);
            } else {
                throw new Error('Unsupported output format: ' + format);
            }

            this.outputBlob = blob;
            this.setProgress(100, 'Done!');

            const baseName = this.audioFile.name.replace(/\.[^.]+$/, '');
            this.resultLabel.textContent = `Converted to ${format.toUpperCase()} successfully!`;
            this.resultSize.textContent = this.formatSize(blob.size);
            this.downloadBtn.dataset.filename = `${baseName}.${format}`;
            this.downloadSection.style.display = 'flex';

        } catch (err) {
            console.error('Conversion error:', err);
            this.setProgress(0, 'Error');
            this.progressText.textContent = 'Conversion failed: ' + err.message;
            setTimeout(() => this.hideProgress(), 4000);
        } finally {
            this.convertBtn.disabled = false;
        }
    }

    /**
     * Encode AudioBuffer to WAV Blob using PCM 16-bit stereo.
     */
    encodeWAV(audioBuffer) {
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const sampleRate  = audioBuffer.sampleRate;
        const format      = 1; // PCM
        const bitDepth    = 16;

        // Interleave channels
        const channels = [];
        for (let c = 0; c < numChannels; c++) {
            channels.push(audioBuffer.getChannelData(c));
        }
        const totalSamples = audioBuffer.length * numChannels;
        const pcmData = new Int16Array(totalSamples);
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let c = 0; c < numChannels; c++) {
                const s = Math.max(-1, Math.min(1, channels[c][i]));
                pcmData[i * numChannels + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
        }

        const dataSize   = pcmData.byteLength;
        const buffer     = new ArrayBuffer(44 + dataSize);
        const view       = new DataView(buffer);
        const byteRate   = sampleRate * numChannels * (bitDepth / 8);
        const blockAlign = numChannels * (bitDepth / 8);

        const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        const pcmBytes = new Uint8Array(buffer, 44);
        pcmBytes.set(new Uint8Array(pcmData.buffer));

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Encode AudioBuffer to MP3 Blob using lamejs.
     * Falls back to WAV if lamejs is not available.
     */
    async encodeMP3(audioBuffer) {
        if (typeof lamejs === 'undefined' || typeof lamejs.Mp3Encoder === 'undefined') {
            console.warn('lamejs not loaded — falling back to WAV');
            this.resultLabel.textContent = 'MP3 encoder unavailable, saving as WAV instead.';
            this.outputFormat.value = 'wav';
            return this.encodeWAV(audioBuffer);
        }

        const bitrate     = parseInt(this.mp3Bitrate.value, 10) || 192;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const sampleRate  = audioBuffer.sampleRate;
        const blockSize   = 1152;

        const left  = audioBuffer.getChannelData(0);
        const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

        const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        const chunks  = [];
        const totalBlocks = Math.ceil(audioBuffer.length / blockSize);

        for (let i = 0; i < totalBlocks; i++) {
            const start = i * blockSize;
            const end   = Math.min(start + blockSize, audioBuffer.length);

            const leftPCM  = this.floatTo16BitPCM(left,  start, end);
            const rightPCM = numChannels > 1 ? this.floatTo16BitPCM(right, start, end) : leftPCM;

            const encoded = numChannels > 1
                ? encoder.encodeBuffer(leftPCM, rightPCM)
                : encoder.encodeBuffer(leftPCM);

            if (encoded.length > 0) chunks.push(new Int8Array(encoded));

            // Update progress: 40% → 90%
            const pct = Math.round(40 + (i / totalBlocks) * 50);
            this.setProgress(pct, 'Encoding MP3...');

            // Yield to browser every 50 blocks to avoid freezing
            if (i % 50 === 0) await this.yield();
        }

        const flushed = encoder.flush();
        if (flushed.length > 0) chunks.push(new Int8Array(flushed));

        return new Blob(chunks, { type: 'audio/mpeg' });
    }

    floatTo16BitPCM(float32Array, start, end) {
        const slice  = float32Array.slice(start, end);
        const output = new Int16Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            const s = Math.max(-1, Math.min(1, slice[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return output;
    }

    yield() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    download() {
        if (!this.outputBlob) return;
        const url  = URL.createObjectURL(this.outputBlob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = this.downloadBtn.dataset.filename || 'converted-audio';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    formatSize(bytes) {
        if (bytes < 1024)       return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}

document.addEventListener('DOMContentLoaded', () => { new AudioConverter(); });
