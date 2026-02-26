# ToolzzHub.com — Feature Guide

Free, browser-based productivity tools. No signup required. All processing happens in your browser — your files are never uploaded to any server.

**Live site:** https://toolzzhub.com
**Version:** Beta 3.0

---

## Table of Contents

1. [PDF Tools](#1-pdf-tools)
2. [Image Tools](#2-image-tools)
3. [File Conversion](#3-file-conversion)
4. [QR Code Generator](#4-qr-code-generator)
5. [Privacy & Security](#5-privacy--security)

---

## 1. PDF Tools

### PDF Merge, Split, Compress & Edit
**URL:** `/pdf/merge.html`

Combine, reorganise, and reduce the size of PDF files entirely in your browser.

**Features:**
- Upload multiple PDF files via drag-and-drop or file browser
- Reorder pages by dragging thumbnails
- Remove individual pages before merging
- Visual page thumbnail preview with fullscreen view
- Add page numbers to the output document
- Three compression options on download:
  - **No Compression** — original quality
  - **Standard** — balanced size reduction (~30%)
  - **Strong** — maximum size reduction (~60%)
- Download the final merged PDF with one click

**Supported input:** Any valid PDF file
**Output:** Single merged PDF

---

### eSign PDF
**URL:** `/esign/request.html`

Sign PDF documents digitally without printing or scanning.

**Features:**
- Upload any PDF and view all pages in-browser
- Place signature fields anywhere on any page
- Choose from five cursive signature fonts:
  - Dancing Script
  - Great Vibes
  - Pacifico
  - Cedarville Cursive
  - Allura
- Type your name and see it rendered as a signature
- Download the signed PDF

**Supported input:** Any valid PDF file
**Output:** Signed PDF

---

### Scan to Text (OCR)
**URL:** `/ocr/scan.html`

Extract text from scanned PDFs and images using AI-powered optical character recognition.

**Features:**
- Upload scanned PDF documents or images
- Choose from 9 recognition languages:
  - English, Spanish, French, German, Italian, Portuguese
  - Chinese (Simplified), Japanese
- Image enhancement before recognition
- Auto-rotate skewed pages
- View extracted text in a scrollable panel
- Copy all extracted text to clipboard
- Download extracted text as a `.txt` file
- Download a searchable PDF with the text embedded

**Powered by:** Tesseract.js (runs 100% in-browser)
**Supported input:** PDF, JPG, PNG, WebP, BMP

---

### PDF Convert
**URL:** `/pdf/convert.html`

Convert PDFs to other formats and create PDFs from images.

**Features:**
- Convert PDF pages to images (JPG, PNG)
- Create a PDF from uploaded images
- Adjust output quality
- Page selection for targeted conversion

**Powered by:** PDF.js + jsPDF

---

## 2. Image Tools

### Quick Image Edit
**URL:** `/quick-image-edit/quick_image_edit.html`

A fast, all-in-one image editor that runs entirely in your browser.

**Features:**
- **Resize** — set exact pixel dimensions or use percentage scaling
- **Crop** — drag-to-crop with aspect ratio lock options
- **Rotate** — 90° clockwise/counter-clockwise rotation
- **Flip** — horizontal and vertical flip
- **Add Text** — overlay text on images with font and colour options
- **Change Format** — export in a different format on download
- **High-quality output** using Pica.js for smooth resampling

**Supported input:** JPG, PNG, WebP, GIF, BMP
**Output formats:** JPG, PNG, WebP

---

### Background Remover
**URL:** `/image/background-remover.html`

Remove the background from photos automatically using on-device AI.

**Features:**
- AI-powered automatic background detection and removal
- No API key or account needed — runs entirely in your browser
- Edge smoothing slider to fine-tune the cutout edges
- Replace background with:
  - Transparent (PNG with alpha channel)
  - White
  - Black
  - Custom colour (colour picker)
- Download result as PNG

**Powered by:** MediaPipe SelfieSegmentation (TensorFlow.js)
**Supported input:** JPG, PNG, WebP, BMP, GIF (max 10MB, max 4000×4000px)
**Output:** PNG

---

### Image Format Converter
**URL:** `/image/convert.html`

Convert images between formats with quality control and batch support.

**Features:**
- Batch convert multiple images at once
- Quality control slider for lossy formats
- Preserve or strip metadata
- Download all converted images as a ZIP archive

**Supported input:** JPG, PNG, WebP, GIF, BMP, TIFF
**Output formats:** JPG, PNG, WebP, GIF, BMP

---

## 3. File Conversion

### Document Conversion
**URL:** `/document-conversion/document_conversion.html`

Convert between common document and office formats.

**Features:**
- Convert documents to PDF
- Extract text from PDFs
- Convert spreadsheet data (CSV) to PDF tables
- Convert images to PDF
- Powered by jsPDF and PDF.js — no server required

**Supported input:** PDF, TXT, CSV, JPG, PNG, WebP
**Output formats:** PDF, TXT

---

### Image Conversion
**URL:** `/image-conversion/image_conversion.html`

Advanced image format conversion with batch processing.

**Features:**
- Batch convert up to 50 images at once (max 200MB total)
- Quality control per format
- Image compression option
- Download all results in a single ZIP
- HEIC/HEIF support for iPhone photos

**Supported input:** JPG, PNG, WebP, GIF, BMP, TIFF, ICO, SVG, HEIC, HEIF
**Output formats:** JPG, PNG, WebP, GIF, BMP, ICO

---

### Audio Conversion
**URL:** `/audio-conversion/audio_conversion.html`

Convert audio files between formats — entirely in your browser using the Web Audio API.

**Features:**
- Drag-and-drop audio file upload
- Live audio preview before converting
- Output format selection:
  - **WAV** — lossless, uncompressed (always available)
  - **MP3** — compressed, smaller file size
- MP3 bitrate selection: 96 / 128 / 192 / 320 kbps
- Real-time conversion progress bar
- Download converted file directly

**Powered by:** Web Audio API + lamejs MP3 encoder
**Supported input:** MP3, WAV, OGG, AAC, M4A, FLAC, WebM (max 200MB)
**Output formats:** WAV, MP3

---

## 4. QR Code Generator

### Basic QR Codes
**URL:** `/qr-code/basic/basic-qr.html`

Generate QR codes for everyday use in seconds.

**QR code types:**
- **Website URL** — link to any webpage
- **WiFi Network** — guests scan to connect automatically (WPA/WPA2, WEP, or open)
- **Plain Text** — encode any text message (up to 4,296 characters)
- **Email** — pre-fill recipient, subject, and body
- **Phone Number** — tap-to-call QR code
- **SMS** — pre-fill phone number and message

**Options:**
- Size: 200 / 300 / 400 / 500 px
- Error correction level: Low / Medium / Quartile / High

**Download formats:** PNG, SVG, PDF

---

### Payment & Business QR Codes
**URL:** `/qr-code/payment/payment-business.html`

Professional QR codes for payments and business networking.

**QR code types:**
- **PayPal / Venmo** — link directly to your payment profile
- **Business Card (vCard)** — name, phone, email, company, website; downloads as `.vcf`
- **Event (iCalendar)** — event name, date/time, location, description; downloads as `.ics`

**Download formats:** PNG, SVG, PDF, VCF (contacts), ICS (calendar events)

---

### Custom QR Codes
**URL:** `/qr-code/customization/custom-qr.html`

Styled QR codes with custom colours, dot patterns, and logo embedding.

**Features:**
- Custom foreground and background colours
- Multiple dot/module styles
- Logo or image overlay in the centre
- Error correction auto-adjusted for logo placement

**Download formats:** PNG, SVG

---

## 5. Privacy & Security

All tools on ToolzzHub are designed with privacy first:

- **No file uploads** — every tool processes files locally in your browser using JavaScript
- **No account required** — no login, no email, no personal data collected
- **No server storage** — files never leave your device
- **Works offline** — once the page is loaded, most tools work without an internet connection (CDN libraries are cached by the browser)

---

*ToolzzHub.com — Free tools for everyone.*
