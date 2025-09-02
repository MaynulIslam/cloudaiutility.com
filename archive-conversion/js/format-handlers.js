/**
 * Format Handlers
 * Handles document and e-book format conversions
 */

window.formatHandlers = {
    /**
     * Convert document files (CSV, Excel, JSON, XML)
     */
    async convertDocument(fileData, inputFormat, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing document...');
        
        try {
            // Parse input data
            let data;
            switch (inputFormat) {
                case 'csv':
                    data = await this.parseCSV(fileData, settings);
                    break;
                case 'excel':
                    data = await this.parseExcel(fileData, settings);
                    break;
                case 'json':
                    data = await this.parseJSON(fileData, settings);
                    break;
                case 'xml':
                    data = await this.parseXML(fileData, settings);
                    break;
                default:
                    throw new Error(`Unsupported input format: ${inputFormat}`);
            }
            
            // Convert to output format
            switch (outputFormat) {
                case 'csv':
                    return await this.toCSV(data, fileData.name, settings);
                case 'excel':
                    return await this.toExcel(data, fileData.name, settings);
                case 'json':
                    return await this.toJSON(data, fileData.name, settings);
                case 'xml':
                    return await this.toXML(data, fileData.name, settings);
                default:
                    throw new Error(`Unsupported output format: ${outputFormat}`);
            }
        } catch (error) {
            throw new Error(`Document conversion failed: ${error.message}`);
        }
    },

    /**
     * Parse CSV file
     */
    async parseCSV(fileData, settings) {
        archiveConverter.updateConversionStage('Parsing CSV...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const result = Papa.parse(csvText, {
                        delimiter: settings.csvDelimiter,
                        header: true,
                        skipEmptyLines: true,
                        encoding: settings.encoding
                    });
                    
                    if (result.errors.length > 0) {
                        console.warn('CSV parsing warnings:', result.errors);
                    }
                    
                    resolve({
                        type: 'table',
                        headers: result.meta.fields,
                        data: result.data,
                        meta: result.meta
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(fileData.file, settings.encoding);
        });
    },

    /**
     * Parse Excel file
     */
    async parseExcel(fileData, settings) {
        archiveConverter.updateConversionStage('Parsing Excel...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const sheets = {};
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        
                        if (jsonData.length > 0) {
                            const headers = jsonData[0];
                            const rows = jsonData.slice(1);
                            
                            sheets[sheetName] = {
                                headers: headers,
                                data: rows.map(row => {
                                    const obj = {};
                                    headers.forEach((header, index) => {
                                        obj[header] = row[index] || '';
                                    });
                                    return obj;
                                })
                            };
                        }
                    });
                    
                    resolve({
                        type: 'workbook',
                        sheets: sheets,
                        sheetNames: workbook.SheetNames
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse Excel: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(fileData.file);
        });
    },

    /**
     * Parse JSON file
     */
    async parseJSON(fileData, settings) {
        archiveConverter.updateConversionStage('Parsing JSON...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonText = e.target.result;
                    const data = JSON.parse(jsonText);
                    
                    resolve({
                        type: 'object',
                        data: data
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read JSON file'));
            reader.readAsText(fileData.file, settings.encoding);
        });
    },

    /**
     * Parse XML file
     */
    async parseXML(fileData, settings) {
        archiveConverter.updateConversionStage('Parsing XML...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const xmlText = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    // Check for parsing errors
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        throw new Error('XML parsing error: ' + parseError.textContent);
                    }
                    
                    // Convert XML to JavaScript object
                    const data = this.xmlToObject(xmlDoc.documentElement);
                    
                    resolve({
                        type: 'object',
                        data: data
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse XML: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read XML file'));
            reader.readAsText(fileData.file, settings.encoding);
        });
    },

    /**
     * Convert XML DOM to JavaScript object
     */
    xmlToObject(element) {
        const obj = {};
        
        // Add attributes
        if (element.attributes && element.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                obj['@attributes'][attr.name] = attr.value;
            }
        }
        
        // Add child elements
        const children = element.children;
        if (children.length === 0) {
            // Text content
            const text = element.textContent.trim();
            return text || null;
        } else {
            // Child elements
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const childObj = this.xmlToObject(child);
                
                if (obj[child.tagName]) {
                    // Multiple elements with same name - convert to array
                    if (!Array.isArray(obj[child.tagName])) {
                        obj[child.tagName] = [obj[child.tagName]];
                    }
                    obj[child.tagName].push(childObj);
                } else {
                    obj[child.tagName] = childObj;
                }
            }
        }
        
        return obj;
    },

    /**
     * Convert data to CSV
     */
    async toCSV(data, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to CSV...');
        
        let csvData;
        
        if (data.type === 'table') {
            // Already tabular data
            csvData = data.data;
        } else if (data.type === 'workbook') {
            // Use first sheet
            const firstSheetName = data.sheetNames[0];
            csvData = data.sheets[firstSheetName].data;
        } else if (data.type === 'object') {
            // Convert object to tabular data
            if (Array.isArray(data.data)) {
                csvData = data.data;
            } else {
                // Single object - convert to single row
                csvData = [data.data];
            }
        } else {
            throw new Error('Cannot convert data to CSV format');
        }
        
        const csvText = Papa.unparse(csvData, {
            delimiter: settings.csvDelimiter,
            header: true
        });
        
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.csv'),
            blob: blob,
            format: 'CSV',
            type: 'document'
        };
    },

    /**
     * Convert data to Excel
     */
    async toExcel(data, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to Excel...');
        
        const workbook = XLSX.utils.book_new();
        
        if (data.type === 'table') {
            // Single sheet from table data
            const worksheet = XLSX.utils.json_to_sheet(data.data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        } else if (data.type === 'workbook') {
            // Multiple sheets
            data.sheetNames.forEach(sheetName => {
                const worksheet = XLSX.utils.json_to_sheet(data.sheets[sheetName].data);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });
        } else if (data.type === 'object') {
            // Convert object to sheet
            let sheetData;
            if (Array.isArray(data.data)) {
                sheetData = data.data;
            } else {
                sheetData = [data.data];
            }
            const worksheet = XLSX.utils.json_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        } else {
            throw new Error('Cannot convert data to Excel format');
        }
        
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.xlsx'),
            blob: blob,
            format: 'Excel',
            type: 'document'
        };
    },

    /**
     * Convert data to JSON
     */
    async toJSON(data, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to JSON...');
        
        let jsonData;
        
        if (data.type === 'table') {
            jsonData = data.data;
        } else if (data.type === 'workbook') {
            // Include all sheets
            jsonData = data.sheets;
        } else if (data.type === 'object') {
            jsonData = data.data;
        } else {
            throw new Error('Cannot convert data to JSON format');
        }
        
        const jsonText = settings.prettyFormat ? 
            JSON.stringify(jsonData, null, 2) : 
            JSON.stringify(jsonData);
        
        const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.json'),
            blob: blob,
            format: 'JSON',
            type: 'document'
        };
    },

    /**
     * Convert data to XML
     */
    async toXML(data, originalName, settings) {
        archiveConverter.updateConversionStage('Converting to XML...');
        
        let xmlData;
        
        if (data.type === 'table') {
            xmlData = { records: data.data };
        } else if (data.type === 'workbook') {
            xmlData = { workbook: data.sheets };
        } else if (data.type === 'object') {
            xmlData = data.data;
        } else {
            throw new Error('Cannot convert data to XML format');
        }
        
        const xmlText = this.objectToXML(xmlData, settings);
        const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.xml'),
            blob: blob,
            format: 'XML',
            type: 'document'
        };
    },

    /**
     * Convert JavaScript object to XML
     */
    objectToXML(obj, settings, rootName = 'root') {
        const indent = settings.prettyFormat ? '  ' : '';
        const newline = settings.prettyFormat ? '\n' : '';
        
        const xmlHeader = `<?xml version="1.0" encoding="${settings.encoding}"?>${newline}`;
        
        const objectToXMLString = (obj, name, level = 0) => {
            const currentIndent = indent.repeat(level);
            const nextIndent = indent.repeat(level + 1);
            
            if (obj === null || obj === undefined) {
                return `${currentIndent}<${name}/>${newline}`;
            }
            
            if (typeof obj !== 'object') {
                const escaped = this.escapeXML(String(obj));
                return `${currentIndent}<${name}>${escaped}</${name}>${newline}`;
            }
            
            if (Array.isArray(obj)) {
                let xml = '';
                obj.forEach((item, index) => {
                    xml += objectToXMLString(item, `${name}_${index}`, level);
                });
                return xml;
            }
            
            let xml = `${currentIndent}<${name}>${newline}`;
            
            Object.keys(obj).forEach(key => {
                if (key === '@attributes') return; // Skip attributes for now
                xml += objectToXMLString(obj[key], key, level + 1);
            });
            
            xml += `${currentIndent}</${name}>${newline}`;
            return xml;
        };
        
        return xmlHeader + objectToXMLString(obj, rootName);
    },

    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        return str.replace(/[<>&'"]/g, (char) => {
            switch (char) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return char;
            }
        });
    },

    /**
     * Convert e-book files
     */
    async convertEbook(fileData, inputFormat, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing e-book...');
        
        try {
            switch (inputFormat) {
                case 'epub':
                    return await this.convertEPUB(fileData, outputFormat, settings);
                case 'mobi':
                    return await this.convertMOBI(fileData, outputFormat, settings);
                default:
                    throw new Error(`Unsupported e-book format: ${inputFormat}`);
            }
        } catch (error) {
            throw new Error(`E-book conversion failed: ${error.message}`);
        }
    },

    /**
     * Convert EPUB files
     */
    async convertEPUB(fileData, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing EPUB...');
        
        try {
            // EPUB is essentially a ZIP file
            const zip = new JSZip();
            const epubContent = await zip.loadAsync(fileData.file);
            
            // Extract text content from XHTML files
            const textContent = await this.extractEPUBText(epubContent, settings);
            
            switch (outputFormat) {
                case 'text':
                    return this.createTextFile(textContent, fileData.name);
                case 'extract':
                    return this.extractEPUBContent(epubContent, fileData.name, settings);
                default:
                    throw new Error(`Unsupported output format for EPUB: ${outputFormat}`);
            }
        } catch (error) {
            throw new Error(`Failed to process EPUB: ${error.message}`);
        }
    },

    /**
     * Extract text from EPUB
     */
    async extractEPUBText(epubContent, settings) {
        let fullText = '';
        const textFiles = [];
        
        // Find XHTML/HTML files
        Object.keys(epubContent.files).forEach(fileName => {
            if (fileName.match(/\.(xhtml|html|htm)$/i) && !epubContent.files[fileName].dir) {
                textFiles.push(fileName);
            }
        });
        
        // Sort files (attempt to maintain reading order)
        textFiles.sort();
        
        for (const fileName of textFiles) {
            try {
                const content = await epubContent.files[fileName].async('text');
                const textOnly = this.stripHTML(content);
                fullText += textOnly + '\n\n';
            } catch (error) {
                console.warn(`Failed to extract text from ${fileName}:`, error);
            }
        }
        
        return fullText.trim();
    },

    /**
     * Strip HTML tags from content
     */
    stripHTML(html) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove script and style elements
        const scripts = tempDiv.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Get text content and clean up whitespace
        return tempDiv.textContent || tempDiv.innerText || '';
    },

    /**
     * Extract EPUB content
     */
    async extractEPUBContent(epubContent, originalName, settings) {
        const extractedFiles = [];
        
        // Extract all files except META-INF
        Object.keys(epubContent.files).forEach(async (fileName) => {
            const file = epubContent.files[fileName];
            
            if (!file.dir && !fileName.startsWith('META-INF/')) {
                try {
                    const blob = await file.async('blob');
                    extractedFiles.push({
                        name: fileName,
                        blob: blob
                    });
                } catch (error) {
                    console.warn(`Failed to extract ${fileName}:`, error);
                }
            }
        });
        
        // Create ZIP with extracted content
        const zip = new JSZip();
        extractedFiles.forEach(file => {
            zip.file(file.name, file.blob);
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '_extracted.zip'),
            blob: zipBlob,
            format: 'ZIP',
            type: 'archive'
        };
    },

    /**
     * Convert MOBI files (basic support)
     */
    async convertMOBI(fileData, outputFormat, settings) {
        archiveConverter.updateConversionStage('Processing MOBI...');
        
        // MOBI format is complex and proprietary
        // This is a placeholder for basic text extraction
        throw new Error('MOBI conversion is not yet fully implemented. MOBI is a complex proprietary format.');
    },

    /**
     * Create text file
     */
    createTextFile(content, originalName) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        
        return {
            name: originalName.replace(/\.[^/.]+$/, '.txt'),
            blob: blob,
            format: 'Text',
            type: 'document'
        };
    }
};
