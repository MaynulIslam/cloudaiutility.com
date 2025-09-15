const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const OpenAI = require('openai');

// Initialize OpenAI (you'll need to add your API key to environment variables)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Extract text from PDF
router.post('/extract', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const pdfData = await pdfParse(req.file.buffer);

    const metadata = {
      pages: pdfData.numpages,
      info: pdfData.info,
      documentType: classifyDocument(pdfData.text)
    };

    res.json({
      text: pdfData.text,
      metadata,
      success: true
    });

  } catch (error) {
    console.error('PDF extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract text from PDF',
      details: error.message
    });
  }
});

// Chat with PDF
router.post('/chat', async (req, res) => {
  try {
    const { question, context, history = [], documentType } = req.body;

    if (!question || !context) {
      return res.status(400).json({ error: 'Missing question or context' });
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant helping users understand PDF documents.
        The document type is: ${documentType || 'general'}.
        Provide accurate, helpful answers based on the document content.
        If asked about specific information, cite the relevant parts of the document.
        If the document doesn't contain the requested information, say so clearly.`
      },
      {
        role: 'user',
        content: `Document content: ${context.substring(0, 8000)}\n\nQuestion: ${question}`
      }
    ];

    // Add conversation history
    history.slice(-3).forEach(h => {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      });
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const answer = completion.choices[0].message.content;

    // Extract page references if any
    const pageReferences = extractPageReferences(answer, context);

    // Generate follow-up questions
    const followUpQuestions = generateFollowUpQuestions(question, documentType);

    res.json({
      answer,
      pageReferences,
      suggestedFollowUp: followUpQuestions,
      success: true
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process your question',
      details: error.message
    });
  }
});

// Generate summary
router.post('/summarize', async (req, res) => {
  try {
    const { text, config = {}, documentType } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const { length = 'one page', style = 'formal', focus = 'key points' } = config;

    const prompt = `Create a ${length} summary of this ${documentType || 'document'} in a ${style} style, focusing on ${focus}.

    Document: ${text.substring(0, 10000)}

    Provide a clear, well-structured summary that captures the essential information.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating concise, informative document summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });

    const summary = completion.choices[0].message.content;

    res.json({
      summary,
      config,
      success: true
    });

  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message
    });
  }
});

// Translate document
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage, preserveFormatting = true } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Missing text or target language' });
    }

    const languageNames = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      hi: 'Hindi'
    };

    const targetLang = languageNames[targetLanguage] || targetLanguage;

    const prompt = `Translate the following text to ${targetLang}.
    ${preserveFormatting ? 'Preserve the original formatting, structure, and paragraph breaks.' : ''}

    Text to translate:
    ${text}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate accurately while maintaining the original meaning and tone.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const translatedText = completion.choices[0].message.content;

    res.json({
      translatedText,
      targetLanguage,
      success: true
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      error: 'Failed to translate document',
      details: error.message
    });
  }
});

// Extract structured data
router.post('/extract-data', async (req, res) => {
  try {
    const { text, extractionType } = req.body;

    if (!text || !extractionType) {
      return res.status(400).json({ error: 'Missing text or extraction type' });
    }

    const extractionPrompts = {
      tables: 'Extract all tables from this document and format them as JSON arrays',
      forms: 'Extract all form fields and their values as key-value pairs',
      contacts: 'Extract all contact information (names, emails, phones, addresses)',
      dates: 'Extract all important dates and deadlines mentioned',
      numbers: 'Extract all significant numbers, amounts, and figures',
      terms: 'Extract key terms, definitions, and important clauses'
    };

    const prompt = extractionPrompts[extractionType] || 'Extract structured data from this document';

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Extract and structure data from documents. Return valid JSON format.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nDocument:\n${text.substring(0, 8000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    let extractedData;
    try {
      extractedData = JSON.parse(completion.choices[0].message.content);
    } catch {
      extractedData = completion.choices[0].message.content;
    }

    res.json({
      data: extractedData,
      type: extractionType,
      success: true
    });

  } catch (error) {
    console.error('Data extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract data',
      details: error.message
    });
  }
});

// Smart redaction
router.post('/redact', async (req, res) => {
  try {
    const { text, redactionType = 'pii' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const patterns = {
      pii: {
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        dateOfBirth: /\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g
      },
      financial: {
        accountNumbers: /\b\d{8,12}\b/g,
        amounts: /\$[\d,]+\.?\d*/g,
        routing: /\b\d{9}\b/g,
        iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g
      },
      medical: {
        mrn: /\b(MRN|Medical Record Number)[\s:]*\d+\b/gi,
        insurance: /\b(Policy|Member|Group)[\s#:]*[\w\d]+\b/gi,
        diagnosis: /\b(ICD-10|CPT)[\s:]*[\w\d.]+\b/gi
      }
    };

    const toRedact = patterns[redactionType] || patterns.pii;
    const redactedItems = [];
    let redactedText = text;

    for (const [name, pattern] of Object.entries(toRedact)) {
      const matches = text.match(pattern);
      if (matches) {
        redactedItems.push({
          type: name,
          count: matches.length,
          samples: matches.slice(0, 3).map(m => m.substring(0, 3) + '***')
        });

        redactedText = redactedText.replace(pattern, '[REDACTED]');
      }
    }

    res.json({
      redactedText,
      redactedItems,
      originalLength: text.length,
      redactedLength: redactedText.length,
      success: true
    });

  } catch (error) {
    console.error('Redaction error:', error);
    res.status(500).json({
      error: 'Failed to redact document',
      details: error.message
    });
  }
});

// Helper functions
function classifyDocument(text) {
  const patterns = {
    contract: /agreement|contract|terms|conditions|party|parties/i,
    invoice: /invoice|bill|payment|due date|total amount/i,
    resume: /experience|education|skills|resume|cv|curriculum/i,
    research: /abstract|introduction|methodology|conclusion|references/i,
    report: /executive summary|findings|recommendations|analysis/i,
    legal: /plaintiff|defendant|court|jurisdiction|whereas/i,
    medical: /patient|diagnosis|treatment|medication|symptoms/i,
    financial: /balance sheet|income statement|cash flow|assets|liabilities/i
  };

  const textSample = text.substring(0, 5000).toLowerCase();

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(textSample)) {
      return type;
    }
  }

  return 'general';
}

function extractPageReferences(answer, fullText) {
  const pageRefs = [];
  const pagePattern = /page\s+(\d+)/gi;
  const matches = answer.matchAll(pagePattern);

  for (const match of matches) {
    pageRefs.push(parseInt(match[1]));
  }

  return [...new Set(pageRefs)].sort((a, b) => a - b);
}

function generateFollowUpQuestions(originalQuestion, documentType) {
  const questions = {
    contract: [
      'What are the termination conditions?',
      'What are the payment terms?',
      'What are the key obligations?',
      'Are there any penalties mentioned?'
    ],
    invoice: [
      'What is the total amount due?',
      'When is the payment deadline?',
      'What items are being charged?',
      'Are there any discounts applied?'
    ],
    resume: [
      'What are the key skills?',
      'What is the work experience?',
      'What is the education background?',
      'Are there any certifications?'
    ],
    general: [
      'Can you summarize the main points?',
      'What are the key findings?',
      'Are there any important dates?',
      'What actions are recommended?'
    ]
  };

  const relevant = questions[documentType] || questions.general;

  // Filter out questions similar to the original
  return relevant.filter(q =>
    !originalQuestion.toLowerCase().includes(q.toLowerCase().substring(0, 10))
  ).slice(0, 3);
}

module.exports = router;