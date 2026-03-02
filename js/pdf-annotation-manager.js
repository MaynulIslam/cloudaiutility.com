/**
 * Professional PDF Annotation Manager
 * Based on industry best practices from Adobe Acrobat, PDF.js, and Nutrient
 * 
 * Features:
 * - Layered architecture (Canvas, Text, Annotation layers)
 * - Proper coordinate transformation
 * - State management with undo/redo
 * - Professional UI/UX patterns
 * - Event handling without conflicts
 */

class PDFAnnotationManager {
  constructor(config) {
    // Support both single pdfViewer parameter and config object
    if (config && config.container) {
      // New config-based initialization
      this.container = config.container;
      this.viewport = config.viewport;
      this.pdfCanvas = config.pdfCanvas;
      this.editCanvas = config.editCanvas;
    } else {
      // Legacy pdfViewer parameter
      this.pdfViewer = config;
      this.container = config?.container;
    }
    
    this.annotations = new Map(); // keyed by annotation ID
    this.selectedAnnotation = null;
    this.activeToolType = null;
    this.isEditing = false;
    
    // Layer system
    this.layers = {
      canvas: null,    // PDF content layer
      text: null,      // Text selection layer  
      annotation: null, // Annotation overlay layer
      ui: null         // UI controls layer
    };
    
    // Coordinate system
    if (!this.viewport && config.viewport) {
      this.viewport = config.viewport;
    }
    this.scale = this.viewport?.scale || 1.0;
    this.rotation = this.viewport?.rotation || 0;
    
    // State management
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    
    // Event system
    this.eventListeners = new Map();
    
    this.initialize();
  }
  
  initialize() {
    this.setupLayers();
    this.setupEventHandlers();
    this.setupKeyboardShortcuts();
    console.log('✅ PDF Annotation Manager initialized');
  }
  
  setupLayers() {
    const container = this.container || this.pdfViewer?.container;
    
    if (!container) {
      throw new Error('PDFAnnotationManager: No container element provided');
    }
    
    // Create annotation overlay layer
    this.layers.annotation = document.createElement('div');
    this.layers.annotation.className = 'pdf-annotation-layer interactive';
    this.layers.annotation.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      pointer-events: auto;
    `;
    
    // Create UI controls layer
    this.layers.ui = document.createElement('div');
    this.layers.ui.className = 'pdf-ui-layer';
    this.layers.ui.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 20;
      pointer-events: auto;
    `;
    
    container.appendChild(this.layers.annotation);
    container.appendChild(this.layers.ui);
    
    console.log('✅ Annotation layers created and added to container');
  }
  
  enableInteraction() {
    this.layers.annotation.style.pointerEvents = 'auto';
    this.layers.ui.style.pointerEvents = 'auto';
  }
  
  disableInteraction() {
    this.layers.annotation.style.pointerEvents = 'none';
    this.layers.ui.style.pointerEvents = 'none';
  }
  
  setupEventHandlers() {
    const annotationLayer = this.layers.annotation;
    
    // Mouse events
    this.addEventListener(annotationLayer, 'mousedown', this.handleMouseDown.bind(this));
    this.addEventListener(annotationLayer, 'mousemove', this.handleMouseMove.bind(this));
    this.addEventListener(annotationLayer, 'mouseup', this.handleMouseUp.bind(this));
    this.addEventListener(annotationLayer, 'click', this.handleClick.bind(this));
    this.addEventListener(annotationLayer, 'dblclick', this.handleDoubleClick.bind(this));
    
    // Touch events
    this.addEventListener(annotationLayer, 'touchstart', this.handleTouchStart.bind(this));
    this.addEventListener(annotationLayer, 'touchmove', this.handleTouchMove.bind(this));
    this.addEventListener(annotationLayer, 'touchend', this.handleTouchEnd.bind(this));
  }
  
  setupKeyboardShortcuts() {
    this.addEventListener(document, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
          case 'd':
            e.preventDefault();
            this.duplicateSelected();
            break;
        }
      }
      
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (this.selectedAnnotation) {
            e.preventDefault();
            this.deleteAnnotation(this.selectedAnnotation.id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.cancelCurrentOperation();
          break;
      }
    });
  }
  
  // ====== COORDINATE SYSTEM ======
  
  updateViewport(viewport) {
    this.viewport = viewport;
    this.scale = viewport.scale;
    this.rotation = viewport.rotation;
    
    // Update layer dimensions
    this.layers.annotation.style.width = viewport.width + 'px';
    this.layers.annotation.style.height = viewport.height + 'px';
    this.layers.ui.style.width = viewport.width + 'px';
    this.layers.ui.style.height = viewport.height + 'px';
    
    // Redraw all annotations
    this.renderAnnotations();
  }
  
  // Convert screen coordinates to PDF coordinates
  screenToPdfCoords(screenX, screenY) {
    if (!this.viewport) return { x: screenX, y: screenY };
    
    const rect = this.layers.annotation.getBoundingClientRect();
    const relativeX = screenX - rect.left;
    const relativeY = screenY - rect.top;
    
    // Convert to PDF coordinates (origin at bottom-left)
    const pdfX = relativeX / this.scale;
    const pdfY = (this.viewport.height - relativeY) / this.scale;
    
    return { x: pdfX, y: pdfY };
  }
  
  // Convert PDF coordinates to screen coordinates
  pdfToScreenCoords(pdfX, pdfY) {
    if (!this.viewport) return { x: pdfX, y: pdfY };
    
    const screenX = pdfX * this.scale;
    const screenY = this.viewport.height - (pdfY * this.scale);
    
    return { x: screenX, y: screenY };
  }
  
  // ====== ANNOTATION MANAGEMENT ======
  
  createAnnotation(type, options = {}) {
    const id = this.generateId();
    const annotation = {
      id,
      type,
      pdfCoords: options.pdfCoords || { x: 0, y: 0 },
      properties: {
        text: options.text || '',
        fontSize: options.fontSize || 16,
        fontFamily: options.fontFamily || 'Arial',
        color: options.color || '#000000',
        backgroundColor: options.backgroundColor || 'transparent',
        borderColor: options.borderColor || '#000000',
        borderWidth: options.borderWidth || 1,
        ...options.properties
      },
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        author: options.author || 'User'
      },
      element: null // DOM element reference
    };
    
    this.annotations.set(id, annotation);
    this.renderAnnotation(annotation);
    this.saveState();
    
    return annotation;
  }
  
  updateAnnotation(id, updates) {
    const annotation = this.annotations.get(id);
    if (!annotation) return false;
    
    // Update properties
    if (updates.pdfCoords) annotation.pdfCoords = updates.pdfCoords;
    if (updates.properties) {
      annotation.properties = { ...annotation.properties, ...updates.properties };
    }
    annotation.metadata.modified = new Date().toISOString();
    
    // Re-render
    this.renderAnnotation(annotation);
    this.saveState();
    
    return true;
  }
  
  deleteAnnotation(id) {
    const annotation = this.annotations.get(id);
    if (!annotation) return false;
    
    // Remove DOM element
    if (annotation.element && annotation.element.parentNode) {
      annotation.element.parentNode.removeChild(annotation.element);
    }
    
    // Remove from map
    this.annotations.delete(id);
    
    // Clear selection if this was selected
    if (this.selectedAnnotation && this.selectedAnnotation.id === id) {
      this.selectedAnnotation = null;
    }
    
    this.saveState();
    return true;
  }
  
  selectAnnotation(id) {
    // Deselect current
    if (this.selectedAnnotation) {
      this.removeSelectionUI(this.selectedAnnotation);
    }
    
    // Select new
    const annotation = this.annotations.get(id);
    if (annotation) {
      this.selectedAnnotation = annotation;
      this.showSelectionUI(annotation);
      this.emit('annotationSelected', annotation);
    }
  }
  
  // ====== RENDERING ======
  
  renderAnnotations() {
    // Clear existing rendered annotations
    this.layers.annotation.innerHTML = '';
    this.layers.ui.innerHTML = '';
    
    // Render each annotation
    for (const annotation of this.annotations.values()) {
      this.renderAnnotation(annotation);
    }
    
    // Re-render selection if needed
    if (this.selectedAnnotation) {
      this.showSelectionUI(this.selectedAnnotation);
    }
  }
  
  renderAnnotation(annotation) {
    switch (annotation.type) {
      case 'text':
        this.renderTextAnnotation(annotation);
        break;
      case 'highlight':
        this.renderHighlightAnnotation(annotation);
        break;
      case 'rectangle':
        this.renderRectangleAnnotation(annotation);
        break;
      case 'stamp':
        this.renderStampAnnotation(annotation);
        break;
      default:
        console.warn('Unknown annotation type:', annotation.type);
    }
  }
  
  renderTextAnnotation(annotation) {
    // Remove existing element
    if (annotation.element && annotation.element.parentNode) {
      annotation.element.parentNode.removeChild(annotation.element);
    }
    
    const screenCoords = this.pdfToScreenCoords(annotation.pdfCoords.x, annotation.pdfCoords.y);
    const props = annotation.properties;
    
    const element = document.createElement('div');
    element.className = 'pdf-text-annotation';
    element.style.cssText = `
      position: absolute;
      left: ${screenCoords.x}px;
      top: ${screenCoords.y - props.fontSize}px;
      font-size: ${props.fontSize}px;
      font-family: ${props.fontFamily};
      color: ${props.color};
      background-color: ${props.backgroundColor};
      border: ${props.borderWidth}px solid ${props.borderColor};
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      padding: 2px 4px;
      border-radius: 2px;
      z-index: 10;
    `;
    
    element.textContent = props.text;
    element.dataset.annotationId = annotation.id;
    
    // Add interaction handlers
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectAnnotation(annotation.id);
    });
    
    element.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.editTextAnnotation(annotation);
    });
    
    annotation.element = element;
    this.layers.annotation.appendChild(element);
  }
  
  // ====== TEXT EDITING ======
  
  editTextAnnotation(annotation) {
    if (this.isEditing) return;
    this.isEditing = true;
    
    const screenCoords = this.pdfToScreenCoords(annotation.pdfCoords.x, annotation.pdfCoords.y);
    const props = annotation.properties;
    
    // Create editor
    const editor = document.createElement('div');
    editor.className = 'pdf-text-editor';
    editor.style.cssText = `
      position: absolute;
      left: ${screenCoords.x}px;
      top: ${screenCoords.y - props.fontSize - 10}px;
      background: white;
      border: 2px solid #007acc;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 200px;
    `;
    
    // Text input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = props.text;
    input.style.cssText = `
      border: none;
      outline: none;
      padding: 8px 12px;
      font-size: ${props.fontSize}px;
      font-family: ${props.fontFamily};
      color: ${props.color};
      width: 100%;
      background: transparent;
    `;
    
    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      border-top: 1px solid #e0e0e0;
      background: #f5f5f5;
    `;
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✓';
    saveBtn.style.cssText = `
      background: #28a745;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕';
    cancelBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
    deleteBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    controls.appendChild(saveBtn);
    controls.appendChild(deleteBtn);
    controls.appendChild(cancelBtn);
    
    editor.appendChild(input);
    editor.appendChild(controls);
    
    // Hide original annotation
    if (annotation.element) {
      annotation.element.style.display = 'none';
    }
    
    this.layers.ui.appendChild(editor);
    input.focus();
    input.select();
    
    // Event handlers
    const save = () => {
      const newText = input.value.trim();
      if (newText) {
        this.updateAnnotation(annotation.id, {
          properties: { text: newText }
        });
      } else {
        this.deleteAnnotation(annotation.id);
      }
      cleanup();
    };
    
    const cancel = () => {
      if (annotation.element) {
        annotation.element.style.display = '';
      }
      cleanup();
    };
    
    const deleteAnnotation = () => {
      this.deleteAnnotation(annotation.id);
      cleanup();
    };
    
    const cleanup = () => {
      this.isEditing = false;
      this.layers.ui.removeChild(editor);
      document.removeEventListener('click', outsideClick);
    };
    
    const outsideClick = (e) => {
      if (!editor.contains(e.target)) {
        save();
      }
    };
    
    // Event listeners
    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    deleteBtn.addEventListener('click', deleteAnnotation);
    
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        save();
      } else if (e.key === 'Escape') {
        cancel();
      }
    });
    
    // Click outside to save
    setTimeout(() => {
      document.addEventListener('click', outsideClick);
    }, 100);
  }
  
  // ====== TOOL SYSTEM ======
  
  setActiveTool(toolType) {
    this.activeToolType = toolType;
    this.updateCursor();
    this.emit('toolChanged', toolType);
  }
  
  updateCursor() {
    const layer = this.layers.annotation;
    switch (this.activeToolType) {
      case 'text':
        layer.style.cursor = 'text';
        break;
      case 'highlight':
        layer.style.cursor = 'not-allowed';
        break;
      case 'select':
        layer.style.cursor = 'default';
        break;
      default:
        layer.style.cursor = 'default';
    }
  }
  
  // ====== EVENT HANDLING ======
  
  handleClick(e) {
    if (this.isEditing) return;
    
    const target = e.target.closest('[data-annotation-id]');
    
    if (target) {
      // Clicked on annotation
      const id = target.dataset.annotationId;
      if (this.activeToolType === 'highlight') {
        // In wipe mode, delete the annotation
        this.deleteAnnotation(id);
        this.emit('annotationWiped', { id });
      } else {
        this.selectAnnotation(id);
      }
    } else {
      // Clicked on empty space
      if (this.activeToolType === 'text') {
        this.createTextAtPosition(e);
      }
      
      // Deselect current annotation
      if (this.selectedAnnotation) {
        this.removeSelectionUI(this.selectedAnnotation);
        this.selectedAnnotation = null;
      }
    }
  }
  
  handleDoubleClick(e) {
    const target = e.target.closest('[data-annotation-id]');
    if (target) {
      const id = target.dataset.annotationId;
      const annotation = this.annotations.get(id);
      if (annotation && annotation.type === 'text') {
        this.editTextAnnotation(annotation);
      }
    }
  }
  
  createTextAtPosition(e) {
    const rect = this.layers.annotation.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pdfCoords = this.screenToPdfCoords(screenX, screenY);
    
    const annotation = this.createAnnotation('text', {
      pdfCoords,
      text: 'Click to edit',
      properties: {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      }
    });
    
    // Start editing immediately
    setTimeout(() => {
      this.editTextAnnotation(annotation);
    }, 50);
  }
  
  // ====== SELECTION UI ======
  
  showSelectionUI(annotation) {
    this.removeSelectionUI(annotation);
    
    if (!annotation.element) return;
    
    const bounds = annotation.element.getBoundingClientRect();
    const layerBounds = this.layers.annotation.getBoundingClientRect();
    
    const selector = document.createElement('div');
    selector.className = 'pdf-annotation-selector';
    selector.style.cssText = `
      position: absolute;
      left: ${bounds.left - layerBounds.left - 2}px;
      top: ${bounds.top - layerBounds.top - 2}px;
      width: ${bounds.width + 4}px;
      height: ${bounds.height + 4}px;
      border: 2px solid #007acc;
      background: rgba(0, 122, 204, 0.1);
      pointer-events: none;
      z-index: 15;
    `;
    
    // Add resize handles
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(position => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${position}`;
      handle.style.cssText = `
        position: absolute;
        width: 8px;
        height: 8px;
        background: #007acc;
        border: 1px solid white;
        cursor: ${position}-resize;
        pointer-events: auto;
      `;
      
      // Position handles
      switch (position) {
        case 'nw': handle.style.top = '-4px'; handle.style.left = '-4px'; break;
        case 'ne': handle.style.top = '-4px'; handle.style.right = '-4px'; break;
        case 'sw': handle.style.bottom = '-4px'; handle.style.left = '-4px'; break;
        case 'se': handle.style.bottom = '-4px'; handle.style.right = '-4px'; break;
      }
      
      selector.appendChild(handle);
    });
    
    annotation._selector = selector;
    this.layers.ui.appendChild(selector);
  }
  
  removeSelectionUI(annotation) {
    if (annotation._selector && annotation._selector.parentNode) {
      annotation._selector.parentNode.removeChild(annotation._selector);
      annotation._selector = null;
    }
  }
  
  // ====== STATE MANAGEMENT ======
  
  saveState() {
    const state = {
      annotations: Array.from(this.annotations.values()).map(ann => ({
        id: ann.id,
        type: ann.type,
        pdfCoords: ann.pdfCoords,
        properties: ann.properties,
        metadata: ann.metadata
      }))
    };
    
    // Remove states after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new state
    this.history.push(JSON.stringify(state));
    this.historyIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }
  
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState();
    }
  }
  
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState();
    }
  }
  
  restoreState() {
    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      const state = JSON.parse(this.history[this.historyIndex]);
      
      // Clear current annotations
      this.annotations.clear();
      this.layers.annotation.innerHTML = '';
      this.layers.ui.innerHTML = '';
      
      // Restore annotations
      state.annotations.forEach(annData => {
        const annotation = {
          ...annData,
          element: null
        };
        this.annotations.set(annotation.id, annotation);
        this.renderAnnotation(annotation);
      });
    }
  }
  
  // ====== UTILITY METHODS ======
  
  generateId() {
    return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    this.eventListeners.get(element).push({ event, handler });
  }
  
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    this.layers.annotation.dispatchEvent(event);
  }
  
  // ====== CLEANUP ======
  
  destroy() {
    // Remove all event listeners
    for (const [element, listeners] of this.eventListeners) {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    }
    this.eventListeners.clear();
    
    // Remove layers
    Object.values(this.layers).forEach(layer => {
      if (layer && layer.parentNode) {
        layer.parentNode.removeChild(layer);
      }
    });
    
    // Clear data
    this.annotations.clear();
    this.history = [];
    
    console.log('📤 PDF Annotation Manager destroyed');
  }
  
  // Stub methods for incomplete event handlers
  handleMouseDown(e) { /* TODO: Implement drag functionality */ }
  handleMouseMove(e) { /* TODO: Implement hover effects */ }
  handleMouseUp(e) { /* TODO: Implement drag end */ }
  handleTouchStart(e) { /* TODO: Implement touch support */ }
  handleTouchMove(e) { /* TODO: Implement touch support */ }
  handleTouchEnd(e) { /* TODO: Implement touch support */ }
  cancelCurrentOperation() { /* TODO: Implement operation cancellation */ }
  duplicateSelected() { /* TODO: Implement duplication */ }
  renderHighlightAnnotation(annotation) { /* TODO: Implement highlight rendering */ }
  renderRectangleAnnotation(annotation) { /* TODO: Implement rectangle rendering */ }
  renderStampAnnotation(annotation) { /* TODO: Implement stamp rendering */ }
}

// Export for use in main application
window.PDFAnnotationManager = PDFAnnotationManager;