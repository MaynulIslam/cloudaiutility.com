/**
 * Archive Handlers
 * Handles archive format conversions (ZIP, TAR, RAR, 7z)
 */

window.archiveHandlers = {
    /**
     * Convert archive files
     */
    async convertArchive(fileData, inputFormat, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing archive...');
        
        try {
            switch (inputFormat) {
                case 'zip':
                    return await this.convertFromZip(fileData, outputFormat, settings);
                case 'tar':
                case 'tar.gz':
                    return await this.convertFromTar(fileData, outputFormat, settings);
                case 'rar':
                    return await this.extractRar(fileData, outputFormat, settings);
                case '7z':
                    return await this.extract7z(fileData, outputFormat, settings);
                default:
                    throw new Error(`Unsupported archive format: ${inputFormat}`);
            }
        } catch (error) {
            throw new Error(`Archive conversion failed: ${error.message}`);
        }
    },

    /**
     * Convert from ZIP format
     */
    async convertFromZip(fileData, outputFormat, settings) {
        const zip = new JSZip();
        
        try {
            const zipContent = await zip.loadAsync(fileData.file);
            
            switch (outputFormat) {
                case 'extract':
                case 'files':
                    return await this.extractZipFiles(zipContent, fileData.name, settings);
                case 'tar':
                    return await this.zipToTar(zipContent, fileData.name, settings);
                default:
                    throw new Error(`Unsupported output format for ZIP: ${outputFormat}`);
            }
        } catch (error) {
            throw new Error(`Failed to process ZIP file: ${error.message}`);
        }
    },

    /**
     * Extract files from ZIP
     */
    async extractZipFiles(zipContent, originalName, settings) {
        archiveConverter.updateConversionStage('Extracting files...');
        
        const extractedFiles = [];
        const files = Object.keys(zipContent.files);
        
        for (let i = 0; i < files.length; i++) {
            const fileName = files[i];
            const file = zipContent.files[fileName];
            
            // Skip directories
            if (file.dir) continue;
            
            // Skip hidden files if not included
            if (!settings.includeHidden && fileName.startsWith('.')) continue;
            
            try {
                const blob = await file.async('blob');
                const extractedName = settings.preserveStructure ? fileName : fileName.split('/').pop();
                
                extractedFiles.push({
                    name: extractedName,
                    blob: blob,
                    format: 'extracted',
                    type: 'file'
                });
            } catch (error) {
                console.warn(`Failed to extract ${fileName}:`, error);
            }
        }
        
        if (extractedFiles.length === 0) {
            throw new Error('No files found in archive');
        }
        
        // If multiple files, create a ZIP containing all extracted files
        if (extractedFiles.length > 1) {
            const newZip = new JSZip();
            
            extractedFiles.forEach(file => {
                newZip.file(file.name, file.blob);
            });
            
            const zipBlob = await newZip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: settings.compressionLevel }
            });
            
            return {
                name: originalName.replace(/\.[^/.]+$/, '_extracted.zip'),
                blob: zipBlob,
                format: 'ZIP',
                type: 'archive'
            };
        } else {
            // Single file extraction
            return extractedFiles[0];
        }
    },

    /**
     * Convert ZIP to TAR
     */
    async zipToTar(zipContent, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to TAR...');
        
        // Note: This is a simplified TAR creation
        // For production, you'd want to use a proper TAR library
        const files = [];
        const fileNames = Object.keys(zipContent.files);
        
        for (const fileName of fileNames) {
            const file = zipContent.files[fileName];
            if (!file.dir) {
                const data = await file.async('uint8array');
                files.push({
                    name: fileName,
                    data: data
                });
            }
        }
        
        const tarBlob = await this.createSimpleTar(files);
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.tar'),
            blob: tarBlob,
            format: 'TAR',
            type: 'archive'
        };
    },

    /**
     * Simple TAR creation (basic implementation)
     */
    async createSimpleTar(files) {
        // This is a very basic TAR implementation
        // For production use, implement proper TAR format or use a library
        
        let totalSize = 0;
        files.forEach(file => {
            totalSize += Math.ceil(file.data.length / 512) * 512 + 512; // Header + data blocks
        });
        
        const tarData = new Uint8Array(totalSize);
        let offset = 0;
        
        files.forEach(file => {
            // Create basic TAR header (simplified)
            const header = new Uint8Array(512);
            const nameBytes = new TextEncoder().encode(file.name);
            header.set(nameBytes.slice(0, 100)); // File name (first 100 bytes)
            
            // File size in octal
            const sizeOctal = file.data.length.toString(8).padStart(11, '0') + '\0';
            const sizeBytes = new TextEncoder().encode(sizeOctal);
            header.set(sizeBytes, 124);
            
            // Copy header
            tarData.set(header, offset);
            offset += 512;
            
            // Copy file data
            tarData.set(file.data, offset);
            offset += Math.ceil(file.data.length / 512) * 512;
        });
        
        return new Blob([tarData], { type: 'application/x-tar' });
    },

    /**
     * Convert from TAR format
     */
    async convertFromTar(fileData, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing TAR archive...');
        
        try {
            const arrayBuffer = await fileData.file.arrayBuffer();
            const tarData = new Uint8Array(arrayBuffer);
            
            const files = await this.parseTar(tarData);
            
            switch (outputFormat) {
                case 'extract':
                case 'files':
                    return await this.createExtractedArchive(files, fileData.name, settings);
                case 'zip':
                    return await this.tarToZip(files, fileData.name, settings);
                default:
                    throw new Error(`Unsupported output format for TAR: ${outputFormat}`);
            }
        } catch (error) {
            throw new Error(`Failed to process TAR file: ${error.message}`);
        }
    },

    /**
     * Basic TAR parser
     */
    async parseTar(tarData) {
        const files = [];
        let offset = 0;
        
        while (offset < tarData.length) {
            // Check for end of archive (two consecutive zero blocks)
            if (offset + 1024 <= tarData.length) {
                const block1 = tarData.slice(offset, offset + 512);
                const block2 = tarData.slice(offset + 512, offset + 1024);
                
                if (block1.every(b => b === 0) && block2.every(b => b === 0)) {
                    break;
                }
            }
            
            // Read header
            const header = tarData.slice(offset, offset + 512);
            
            // Extract filename (first 100 bytes, null-terminated)
            const nameBytes = header.slice(0, 100);
            const nameEnd = nameBytes.indexOf(0);
            const name = new TextDecoder().decode(nameBytes.slice(0, nameEnd > 0 ? nameEnd : 100));
            
            if (!name) break;
            
            // Extract file size (12 bytes starting at offset 124, octal)
            const sizeBytes = header.slice(124, 136);
            const sizeStr = new TextDecoder().decode(sizeBytes).replace(/\0/g, '').trim();
            const size = parseInt(sizeStr, 8) || 0;
            
            offset += 512; // Skip header
            
            if (size > 0) {
                const fileData = tarData.slice(offset, offset + size);
                files.push({
                    name: name,
                    data: fileData,
                    size: size
                });
                
                // Move to next 512-byte boundary
                offset += Math.ceil(size / 512) * 512;
            }
        }
        
        return files;
    },

    /**
     * Convert TAR files to ZIP
     */
    async tarToZip(files, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to ZIP...');
        
        const zip = new JSZip();
        
        files.forEach(file => {
            const blob = new Blob([file.data]);
            zip.file(file.name, blob);
        });
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: settings.compressionLevel }
        });
        
        return {
            name: originalName.replace(/\.(tar|tar\.gz)$/, '.zip'),
            blob: zipBlob,
            format: 'ZIP',
            type: 'archive'
        };
    },

    /**
     * Create extracted archive from files
     */
    async createExtractedArchive(files, originalName, settings) {
        if (files.length === 0) {
            throw new Error('No files found in archive');
        }
        
        if (files.length === 1) {
            // Single file
            return {
                name: files[0].name,
                blob: new Blob([files[0].data]),
                format: 'extracted',
                type: 'file'
            };
        } else {
            // Multiple files - create ZIP
            const zip = new JSZip();
            
            files.forEach(file => {
                const fileName = settings.preserveStructure ? file.name : file.name.split('/').pop();
                zip.file(fileName, new Blob([file.data]));
            });
            
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: settings.compressionLevel }
            });
            
            return {
                name: originalName.replace(/\.[^/.]+$/, '_extracted.zip'),
                blob: zipBlob,
                format: 'ZIP',
                type: 'archive'
            };
        }
    },

    /**
     * Extract RAR files (limited support)
     */
    async extractRar(fileData, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing RAR archive...');
        
        // RAR format is proprietary and complex
        // This is a placeholder for basic RAR extraction
        throw new Error('RAR extraction is not yet implemented. RAR is a proprietary format that requires special libraries.');
    },

    /**
     * Extract 7z files (limited support)
     */
    async extract7z(fileData, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing 7z archive...');
        
        // 7z format requires specialized libraries
        // This is a placeholder for basic 7z extraction
        throw new Error('7z extraction is not yet implemented. This feature requires additional libraries.');
    },

    /**
     * Create archive from multiple files
     */
    async createArchive(files, format, name, settings) {
        archiveConverter.updateConversionStage('Creating archive...');
        
        switch (format) {
            case 'zip':
                return await this.createZipArchive(files, name, settings);
            case 'tar':
                return await this.createTarArchive(files, name, settings);
            default:
                throw new Error(`Unsupported archive format: ${format}`);
        }
    },

    /**
     * Create ZIP archive from files
     */
    async createZipArchive(files, name, settings) {
        const zip = new JSZip();
        
        files.forEach(fileData => {
            const fileName = settings.preserveStructure ? 
                (fileData.webkitRelativePath || fileData.name) : 
                fileData.name;
            
            zip.file(fileName, fileData.file);
        });
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: settings.compressionLevel }
        });
        
        return {
            name: name || 'archive.zip',
            blob: zipBlob,
            format: 'ZIP',
            type: 'archive'
        };
    },

    /**
     * Create TAR archive from files
     */
    async createTarArchive(files, name, settings) {
        // Convert files to the format needed for TAR creation
        const tarFiles = [];
        
        for (const fileData of files) {
            const data = await this.fileToUint8Array(fileData.file);
            const fileName = settings.preserveStructure ? 
                (fileData.webkitRelativePath || fileData.name) : 
                fileData.name;
            
            tarFiles.push({
                name: fileName,
                data: data
            });
        }
        
        const tarBlob = await this.createSimpleTar(tarFiles);
        
        return {
            name: name || 'archive.tar',
            blob: tarBlob,
            format: 'TAR',
            type: 'archive'
        };
    },

    /**
     * Convert File to Uint8Array
     */
    async fileToUint8Array(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(new Uint8Array(e.target.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
};
