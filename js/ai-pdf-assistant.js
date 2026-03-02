class AIPDFAssistant {
  constructor() {
    this.apiEndpoint = '/api/ai/pdf';
    this.currentPDF = null;
    this.chatHistory = [];
    this.extractedText = '';
  }

  async initializeChat(pdfFile) {
    this.currentPDF = pdfFile;
    await this.extractText();
    this.initializeChatUI();
    return this;
  }

  async extractText() {
    const formData = new FormData();
    formData.append('pdf', this.currentPDF);

    try {
      const response = await fetch(`${this.apiEndpoint}/extract`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      this.extractedText = data.text;
      this.metadata = data.metadata;

      this.showQuickInsights();
    } catch (error) {
      console.error('Text extraction failed:', error);
      this.showError('Failed to process PDF. Please try again.');
    }
  }

  showQuickInsights() {
    const insights = {
      pageCount: this.metadata.pages,
      wordCount: this.extractedText.split(' ').length,
      readingTime: Math.ceil(this.extractedText.split(' ').length / 200),
      language: this.detectLanguage(this.extractedText),
      documentType: this.classifyDocument()
    };

    this.displayInsights(insights);
    this.suggestActions(insights);
  }

  classifyDocument() {
    const patterns = {
      contract: /agreement|contract|terms|conditions|party|parties/i,
      invoice: /invoice|bill|payment|due date|total amount/i,
      resume: /experience|education|skills|resume|cv|curriculum/i,
      research: /abstract|introduction|methodology|conclusion|references/i,
      report: /executive summary|findings|recommendations|analysis/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(this.extractedText.substring(0, 5000))) {
        return type;
      }
    }
    return 'general';
  }

  suggestActions(insights) {
    const suggestions = {
      contract: [
        'Extract key terms and dates',
        'Identify obligations and rights',
        'Find termination clauses',
        'Summarize payment terms'
      ],
      invoice: [
        'Extract line items to spreadsheet',
        'Calculate tax breakdown',
        'Verify totals',
        'Export to accounting format'
      ],
      resume: [
        'Extract contact information',
        'Analyze skill keywords',
        'Create ATS-friendly version',
        'Generate cover letter'
      ],
      research: [
        'Generate executive summary',
        'Extract citations',
        'Find key findings',
        'Create presentation slides'
      ]
    };

    const actions = suggestions[insights.documentType] || [
      'Generate summary',
      'Extract key points',
      'Translate document',
      'Ask questions'
    ];

    this.displaySuggestedActions(actions);
  }

  async askQuestion(question) {
    this.addToChatHistory('user', question);
    this.showTypingIndicator();

    try {
      const response = await fetch(`${this.apiEndpoint}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: this.extractedText,
          history: this.chatHistory.slice(-5),
          documentType: this.metadata.documentType
        })
      });

      const data = await response.json();

      this.addToChatHistory('assistant', data.answer);

      if (data.pageReferences) {
        this.highlightReferences(data.pageReferences);
      }

      if (data.suggestedFollowUp) {
        this.showFollowUpQuestions(data.suggestedFollowUp);
      }

    } catch (error) {
      this.showError('Failed to process your question. Please try again.');
    } finally {
      this.hideTypingIndicator();
    }
  }

  async generateSummary(type = 'executive') {
    const summaryTypes = {
      executive: { length: 'one page', style: 'formal', focus: 'key decisions' },
      bullet: { length: 'bullet points', style: 'concise', focus: 'main points' },
      simple: { length: 'short', style: 'simple language', focus: 'easy understanding' },
      technical: { length: 'detailed', style: 'technical', focus: 'specifications' }
    };

    const config = summaryTypes[type];

    try {
      const response = await fetch(`${this.apiEndpoint}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.extractedText,
          config,
          documentType: this.metadata.documentType
        })
      });

      const data = await response.json();
      this.displaySummary(data.summary, type);

      return data.summary;
    } catch (error) {
      this.showError('Summary generation failed. Please try again.');
    }
  }

  async extractData(extractionType) {
    const extractors = {
      tables: this.extractTables,
      forms: this.extractFormFields,
      contacts: this.extractContactInfo,
      dates: this.extractImportantDates,
      numbers: this.extractKeyNumbers,
      terms: this.extractKeyTerms
    };

    const extractor = extractors[extractionType];
    if (!extractor) return;

    try {
      const data = await extractor.call(this);
      this.displayExtractedData(data, extractionType);
      this.offerExport(data, extractionType);
      return data;
    } catch (error) {
      this.showError(`Failed to extract ${extractionType}`);
    }
  }

  async translateDocument(targetLanguage) {
    this.showProgress('Translating document...', 0);

    try {
      const chunks = this.chunkText(this.extractedText, 3000);
      const translated = [];

      for (let i = 0; i < chunks.length; i++) {
        const response = await fetch(`${this.apiEndpoint}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunks[i],
            targetLanguage,
            preserveFormatting: true
          })
        });

        const data = await response.json();
        translated.push(data.translatedText);

        this.showProgress('Translating document...', ((i + 1) / chunks.length) * 100);
      }

      const fullTranslation = translated.join(' ');
      await this.createTranslatedPDF(fullTranslation, targetLanguage);

    } catch (error) {
      this.showError('Translation failed. Please try again.');
    } finally {
      this.hideProgress();
    }
  }

  async smartRedact(redactionType = 'pii') {
    const patterns = {
      pii: {
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
      },
      financial: {
        accountNumbers: /\b\d{8,12}\b/g,
        amounts: /\$[\d,]+\.?\d*/g,
        routing: /\b\d{9}\b/g
      },
      custom: this.customPatterns || {}
    };

    const toRedact = patterns[redactionType];
    const redactedItems = [];

    for (const [name, pattern] of Object.entries(toRedact)) {
      const matches = this.extractedText.match(pattern);
      if (matches) {
        redactedItems.push({ type: name, count: matches.length, samples: matches.slice(0, 3) });
      }
    }

    if (redactedItems.length > 0) {
      this.showRedactionPreview(redactedItems);
      const confirmed = await this.confirmRedaction();

      if (confirmed) {
        await this.applyRedactions(redactedItems);
      }
    } else {
      this.showInfo('No sensitive information found to redact.');
    }
  }

  initializeChatUI() {
    const chatHTML = `
      <div class="ai-chat-container">
        <div class="chat-header">
          <h3>AI PDF Assistant</h3>
          <span class="status-indicator">Ready</span>
        </div>

        <div class="quick-actions">
          <button onclick="pdfAssistant.generateSummary('executive')">📄 Summary</button>
          <button onclick="pdfAssistant.extractData('tables')">📊 Extract Tables</button>
          <button onclick="pdfAssistant.translateDocument('es')">🌍 Translate</button>
          <button onclick="pdfAssistant.smartRedact('pii')">🔒 Redact PII</button>
        </div>

        <div class="chat-messages" id="chat-messages"></div>

        <div class="suggested-questions" id="suggested-questions"></div>

        <div class="chat-input-container">
          <input
            type="text"
            id="chat-input"
            placeholder="Ask anything about your PDF..."
            onkeypress="if(event.key==='Enter') pdfAssistant.sendMessage()"
          />
          <button onclick="pdfAssistant.sendMessage()">Send</button>
        </div>
      </div>
    `;

    document.getElementById('ai-assistant-panel').innerHTML = chatHTML;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('chat-input').addEventListener('input', (e) => {
      this.handleInputChange(e.target.value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        document.getElementById('chat-input').focus();
      }
    });
  }

  addToChatHistory(role, content) {
    this.chatHistory.push({ role, content, timestamp: Date.now() });
    this.displayMessage(role, content);
  }

  displayMessage(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    if (role === 'assistant' && content.includes('```')) {
      content = this.formatCodeBlocks(content);
    }

    messageDiv.innerHTML = `
      <div class="message-content">${content}</div>
      <div class="message-actions">
        ${role === 'assistant' ? '<button onclick="pdfAssistant.copyResponse(this)">📋 Copy</button>' : ''}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  showFollowUpQuestions(questions) {
    const container = document.getElementById('suggested-questions');
    container.innerHTML = questions.map(q =>
      `<button class="follow-up-btn" onclick="pdfAssistant.askQuestion('${q}')">${q}</button>`
    ).join('');
  }

  chunkText(text, chunkSize) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  detectLanguage(text) {
    const languages = {
      en: /\b(the|and|of|to|in|is|that|it|was|for)\b/i,
      es: /\b(el|la|de|que|y|en|un|por|con|para)\b/i,
      fr: /\b(le|de|un|être|et|à|il|avoir|ce|pour)\b/i,
      de: /\b(der|die|und|in|das|von|zu|mit|sich|auf)\b/i
    };

    const sample = text.substring(0, 1000).toLowerCase();
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, pattern] of Object.entries(languages)) {
      const matches = sample.match(pattern) || [];
      if (matches.length > maxScore) {
        maxScore = matches.length;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    input.value = '';
    await this.askQuestion(message);
  }

  copyResponse(button) {
    const content = button.closest('.chat-message').querySelector('.message-content').textContent;
    navigator.clipboard.writeText(content);
    button.textContent = '✓ Copied';
    setTimeout(() => button.textContent = '📋 Copy', 2000);
  }

  showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    document.getElementById('chat-messages').appendChild(indicator);
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  showProgress(message, percentage) {
    const progressBar = document.getElementById('progress-bar') || this.createProgressBar();
    progressBar.querySelector('.progress-message').textContent = message;
    progressBar.querySelector('.progress-fill').style.width = `${percentage}%`;
    progressBar.querySelector('.progress-percentage').textContent = `${Math.round(percentage)}%`;
  }

  createProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
      <div class="progress-message"></div>
      <div class="progress-track">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-percentage">0%</div>
    `;
    document.body.appendChild(progressBar);
    return progressBar;
  }

  hideProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.remove();
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  displayInsights(insights) {
    const insightsHTML = `
      <div class="pdf-insights">
        <h4>Document Insights</h4>
        <div class="insights-grid">
          <div class="insight">
            <span class="insight-label">Pages</span>
            <span class="insight-value">${insights.pageCount}</span>
          </div>
          <div class="insight">
            <span class="insight-label">Words</span>
            <span class="insight-value">${insights.wordCount.toLocaleString()}</span>
          </div>
          <div class="insight">
            <span class="insight-label">Reading Time</span>
            <span class="insight-value">${insights.readingTime} min</span>
          </div>
          <div class="insight">
            <span class="insight-label">Type</span>
            <span class="insight-value">${insights.documentType}</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('insights-panel').innerHTML = insightsHTML;
  }

  displaySuggestedActions(actions) {
    const actionsHTML = actions.map(action =>
      `<button class="action-btn" onclick="pdfAssistant.executeAction('${action}')">${action}</button>`
    ).join('');

    document.getElementById('suggested-actions').innerHTML = actionsHTML;
  }

  formatCodeBlocks(content) {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code)}</code></pre>`;
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const pdfAssistant = new AIPDFAssistant();

window.initializeAIPDF = async (file) => {
  await pdfAssistant.initializeChat(file);
  document.getElementById('ai-features').classList.add('active');
};