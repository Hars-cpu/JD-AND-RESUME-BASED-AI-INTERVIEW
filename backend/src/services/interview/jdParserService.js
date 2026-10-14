/**
 * @file jdParserService.js
 * @summary Service that parses a Job Description (JD) PDF into structured data.
 *          Extracts text from the PDF buffer using pdf-parse, sends it to the Groq/Gemini LLM
 *          with a structured extraction prompt, validates and normalizes the JSON output, and
 *          falls back to a local regex-based parser on API failure.
 *
 * @functions
 * - repairJson: Strips trailing commas and common JSON syntax bugs before re-parsing.
 * - extractJson: Strips markdown fences, slices to JSON boundaries, parses, and repairs on failure.
 * - normalizeStringArray: Converts an array field from LLM output to cleaned non-empty strings.
 * - validateAndProvideDefaults: Validates the parsed object has required JD keys and normalizes each field.
 * - parseJdLocally: Local regex fallback — scans lines for known skill keywords and section headers
 *                   to extract requiredSkills, technologies, responsibilities, and experienceRequired.
 * - extractJdText: Uses pdf-parse to extract text from the PDF buffer; throws on empty or corrupt files.
 * - parseJdWithGROQ: Sends extracted text to the LLM with a structured prompt and falls back to parseJdLocally.
 * - parseJd: Main exported function — chains extractJdText → parseJdWithGROQ and returns the result.
 * - class JdParserError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');
const pdfParse = require('pdf-parse');

const EMPTY_JD_RESPONSE = {
  requiredSkills: [],
  preferredSkills: [],
  technologies: [],
  responsibilities: [],
  experienceRequired: '',
  keywords: []
};

class JdParserError extends Error {
  constructor(message, statusCode = 500, code = 'JD_PARSER_ERROR') {
    super(message);
    this.name = 'JdParserError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Strips trailing commas and other common JSON formatting bugs.
 */
const repairJson = (text) => {
  let cleaned = text.trim();
  // Strip trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  return cleaned;
};

/**
 * Extracts and cleans JSON from GROQ text output.
 */
const extractJson = (text) => {
  if (!text || typeof text !== 'string') {
    throw new JdParserError('GROQ returned an empty response', 502, 'GROQ_INVALID_RESPONSE');
  }

  const cleanedText = text.trim();
  console.log('[JSON Parsing] Raw text length:', cleanedText.length);

  // Look for markdown code block with or without "json" label
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = cleanedText.match(fencedRegex);
  let jsonText = match ? match[1].trim() : cleanedText;

  // If JSON is not wrapped in backticks but has text before/after, slice to boundaries
  if (!jsonText.startsWith('{') && jsonText.includes('{')) {
    jsonText = jsonText.slice(jsonText.indexOf('{'));
  }
  if (!jsonText.endsWith('}') && jsonText.includes('}')) {
    jsonText = jsonText.slice(0, jsonText.lastIndexOf('}') + 1);
  }

  console.log('[JSON Parsing] Extracted JSON text length:', jsonText.length);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn('[JSON Parsing] Initial JSON.parse failed. Attempting repair...', error.message);
    try {
      const repairedText = repairJson(jsonText);
      const parsed = JSON.parse(repairedText);
      console.log('[JSON Parsing] JSON parsed successfully after repair.');
      return parsed;
    } catch (repairError) {
      console.error('[JSON Parsing] JSON repair failed:', repairError.message);
      throw new JdParserError(
        `JSON parse failure: Failed to parse JSON response from GROQ. ${error.message}`,
        502,
        'JSON_PARSE_FAILURE'
      );
    }
  }
};

/**
 * Normalizes array strings.
 */
const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

/**
 * Validates the schema, ensures correct types, handles missing values, and provides safe defaults.
 */
const validateAndProvideDefaults = (data) => {
  if (!data || typeof data !== 'object') {
    throw new JdParserError('Schema validation failure: Parsed data is not a valid object matching the JD schema', 422, 'SCHEMA_VALIDATION_FAILURE');
  }

  // If all major keys are missing, throw a schema validation failure
  const hasSomeKeys = ['requiredSkills', 'preferredSkills', 'technologies', 'responsibilities', 'experienceRequired', 'keywords'].some(k => k in data);
  if (!hasSomeKeys) {
    throw new JdParserError('Schema validation failure: Parsed JD data is missing required schema fields', 422, 'SCHEMA_VALIDATION_FAILURE');
  }

  const validated = {};

  // 1. requiredSkills
  if ('requiredSkills' in data) {
    if (Array.isArray(data.requiredSkills)) {
      validated.requiredSkills = normalizeStringArray(data.requiredSkills);
    } else if (typeof data.requiredSkills === 'string') {
      validated.requiredSkills = data.requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      validated.requiredSkills = [];
    }
  } else {
    validated.requiredSkills = [];
  }

  // 2. preferredSkills
  if ('preferredSkills' in data) {
    if (Array.isArray(data.preferredSkills)) {
      validated.preferredSkills = normalizeStringArray(data.preferredSkills);
    } else if (typeof data.preferredSkills === 'string') {
      validated.preferredSkills = data.preferredSkills.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      validated.preferredSkills = [];
    }
  } else {
    validated.preferredSkills = [];
  }

  // 3. technologies
  if ('technologies' in data) {
    if (Array.isArray(data.technologies)) {
      validated.technologies = normalizeStringArray(data.technologies);
    } else if (typeof data.technologies === 'string') {
      validated.technologies = data.technologies.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      validated.technologies = [];
    }
  } else {
    validated.technologies = [];
  }

  // 4. responsibilities
  if ('responsibilities' in data) {
    if (Array.isArray(data.responsibilities)) {
      validated.responsibilities = normalizeStringArray(data.responsibilities);
    } else if (typeof data.responsibilities === 'string') {
      validated.responsibilities = data.responsibilities.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      validated.responsibilities = [];
    }
  } else {
    validated.responsibilities = [];
  }

  // 5. experienceRequired
  if ('experienceRequired' in data) {
    validated.experienceRequired = typeof data.experienceRequired === 'string' ? data.experienceRequired.trim() : '';
  } else {
    validated.experienceRequired = '';
  }

  // 6. keywords
  if ('keywords' in data) {
    if (Array.isArray(data.keywords)) {
      validated.keywords = normalizeStringArray(data.keywords);
    } else if (typeof data.keywords === 'string') {
      validated.keywords = data.keywords.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      validated.keywords = [];
    }
  } else {
    validated.keywords = [];
  }

  return validated;
};

/**
 * Premium local text processing & regex parser (for offline / 429 quota failures).
 */
const parseJdLocally = (jdText) => {
  const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean);
  
  const skillDictionary = [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php',
    'html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask',
    'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'firebase', 'docker', 'aws',
    'git', 'github', 'graphql', 'rest', 'api', 'oops', 'dsa', 'system design'
  ];

  const matchedSkills = [];
  skillDictionary.forEach(skill => {
    const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'gi');
    const matches = jdText.match(regex);
    if (matches && matches.length > 0) {
      const rawMatch = matches[0].trim();
      let formattedSkill = skillDictionary.find(s => s.toLowerCase() === rawMatch.toLowerCase()) || rawMatch;
      
      // Map to standard nice casing
      if (formattedSkill === 'javascript') formattedSkill = 'JavaScript';
      if (formattedSkill === 'typescript') formattedSkill = 'TypeScript';
      if (formattedSkill === 'react') formattedSkill = 'React';
      if (formattedSkill === 'node') formattedSkill = 'Node.js';
      if (formattedSkill === 'express') formattedSkill = 'Express';
      if (formattedSkill === 'mongodb') formattedSkill = 'MongoDB';
      if (formattedSkill === 'postgresql') formattedSkill = 'PostgreSQL';
      if (formattedSkill === 'mysql') formattedSkill = 'MySQL';
      if (formattedSkill === 'graphql') formattedSkill = 'GraphQL';
      if (formattedSkill === 'oops') formattedSkill = 'OOPs';
      if (formattedSkill === 'dsa') formattedSkill = 'DSA';
      if (formattedSkill === 'system design') formattedSkill = 'System Design';

      if (!matchedSkills.includes(formattedSkill)) {
        matchedSkills.push(formattedSkill);
      }
    }
  });

  const requiredSkills = matchedSkills.slice(0, 5);
  const preferredSkills = matchedSkills.slice(5, 8);
  const technologies = matchedSkills;
  const responsibilities = [];
  let experienceRequired = '2+ years';

  let currentSection = 'general';

  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('responsibilit') || lowerLine.includes('what you will do') || lowerLine.includes('duties') || lowerLine.includes('role')) {
      currentSection = 'responsibilities';
      return;
    }
    if (lowerLine.includes('requirement') || lowerLine.includes('qualification') || lowerLine.includes('skills required')) {
      currentSection = 'requirements';
      return;
    }

    if (currentSection === 'responsibilities') {
      if (line.length > 15 && line.length < 120 && !responsibilities.includes(line)) {
        responsibilities.push(line);
      }
    }

    // Extract experience years
    const expMatch = line.match(/(\d+)\+?\s*(years?|yrs?)\b/i);
    if (expMatch) {
      experienceRequired = `${expMatch[1]}+ years`;
    }
  });

  // Fallbacks if section detection missed items
  if (responsibilities.length === 0) {
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if ((lower.includes('lead') || lower.includes('build') || lower.includes('design') || lower.includes('develop') || lower.includes('collaborate')) && line.length > 15 && line.length < 120) {
        responsibilities.push(line);
      }
    });
  }

  const keywords = [...requiredSkills, ...preferredSkills, 'Software Engineer', 'Full Stack'];

  return {
    requiredSkills: requiredSkills,
    preferredSkills: preferredSkills,
    technologies: technologies.slice(0, 10),
    responsibilities: responsibilities.slice(0, 6),
    experienceRequired: experienceRequired,
    keywords: keywords.slice(0, 6)
  };
};

/**
 * Parses and extracts text from standard PDF buffers.
 */
const extractJdText = async (fileBuffer) => {
  console.log(`[JD PDF Extraction] Input is Buffer: ${Buffer.isBuffer(fileBuffer)}, Size: ${fileBuffer ? fileBuffer.length : 0} bytes`);
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new JdParserError('Empty PDF content: No bytes received', 400, 'EMPTY_PDF_CONTENT');
    }
    const result = await pdfParse(fileBuffer);
    const jdText = result?.text?.trim() || '';

    console.log(`[JD PDF Extraction] Extracted text length: ${jdText.length}`);
    if (jdText.length > 0) {
      console.log(`[JD PDF Extraction] First 500 characters of extracted text:\n${jdText.slice(0, 500)}`);
    }

    if (!jdText) {
      throw new JdParserError('Empty PDF content: Uploaded PDF does not contain readable text (blank or scanned)', 400, 'EMPTY_PDF_CONTENT');
    }

    return jdText;
  } catch (error) {
    console.error('[JD PDF Extraction] Error parsing PDF:', error);
    if (error instanceof JdParserError) throw error;
    throw new JdParserError(`PDF extraction failed: ${error.message}`, 400, 'PDF_EXTRACTION_FAILED');
  }
};

/**
 * Requests GROQ to extract structured job details. Fallback enabled.
 */
const parseJdWithGROQ = async (jdText) => {
  if (!process.env.GROQ_API_KEY) {
    throw new JdParserError('Groq API key is not configured', 500, 'GROQ_NOT_CONFIGURED');
  }

  console.log('[JD GROQ Request] API Key exists: true');
  console.log('[JD GROQ Request] Model name: GROQ-2.5-flash');
  console.log('[JD GROQ Request] Prompt text length:', jdText.length);

  try {

    const prompt = `
You are a job description parser for CodeSangram's AI Interview Copilot.

Extract structured job description information from the text below.

Return ONLY valid JSON with this exact shape:
{
  "requiredSkills": [],
  "preferredSkills": [],
  "technologies": [],
  "responsibilities": [],
  "experienceRequired": "",
  "keywords": []
}

Rules:
- Use arrays of concise strings.
- Do not invent information.
- If a section is missing, return an empty array or empty string.
- Keep experienceRequired short and faithful to the JD.
- Put important role/search terms in keywords.

Job description text:
${jdText.slice(0, 30000)}
`;

    const responseText = await generateContent({ prompt, jsonMode: true });
    
    // Log response details
    console.log('[JD GROQ Response] Request status: SUCCESS');
    console.log('[JD GROQ Response] Raw output:', responseText);

    if (!responseText) {
      throw new JdParserError('Invalid GROQ response: GROQ returned empty content', 502, 'GROQ_INVALID_RESPONSE');
    }

    const parsedData = extractJson(responseText);
    return validateAndProvideDefaults(parsedData);
  } catch (error) {
    // If it's a known non-GROQ API error (e.g. PDF extraction or Schema failure), propagate it
    if (error instanceof JdParserError && error.code !== 'JSON_PARSE_FAILURE') {
      console.warn(`⚠️ JD parser error occurred: [${error.code}] ${error.message}`);
      throw error;
    }

    // For GROQ API errors (rate limits, 429s, network failures, etc.) or JSON parse failure, trigger premium local fallback
    console.warn("⚠️ GROQ API or JSON parsing failure on JD, activating premium local fallback regex parser. Reason:", error.message);
    
    // Log details of the fallback trigger
    if (error instanceof JdParserError && error.code === 'JSON_PARSE_FAILURE') {
      console.warn('Fallback activated due to: JSON_PARSE_FAILURE');
    } else {
      console.warn('Fallback activated due to: GROQ_API_FAILURE');
    }

    return parseJdLocally(jdText);
  }
};

/**
 * Main JD parser entry point.
 */
const parseJd = async (fileBuffer) => {
  const jdText = await extractJdText(fileBuffer);
  const structuredData = await parseJdWithGROQ(jdText);

  return {
    ...EMPTY_JD_RESPONSE,
    ...structuredData
  };
};

module.exports = {
  JdParserError,
  extractJdText,
  parseJdWithGROQ,
  parseJd
};
