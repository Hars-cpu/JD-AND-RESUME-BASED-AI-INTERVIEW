/**
 * @file resumeParserService.js
 * @summary Service that parses a resume PDF into structured data.
 *          Extracts raw text from the PDF buffer using pdf-parse, sends it to the Groq/Gemini LLM
 *          with a structured extraction prompt, validates and normalizes the JSON output, and
 *          falls back to a local regex-based skill/section extractor on API failure.
 *
 * @functions
 * - repairJson: Strips trailing commas and common JSON syntax bugs before re-parsing.
 * - extractJson: Strips markdown fences, slices to JSON boundaries, parses, and repairs on failure.
 * - normalizeStringArray: Converts an array field from LLM output to cleaned non-empty strings.
 * - validateAndProvideDefaults: Validates the parsed object has resume keys and normalizes each field.
 * - parseResumeLocally: Local regex fallback — scans resume text for known skill keywords and section headers
 *                       to extract skills, projects, experience, education, and a summary.
 * - extractResumeText: Uses pdf-parse to extract text from the PDF buffer; throws on empty or corrupt files.
 * - parseResumeWithGROQ: Sends extracted text to the LLM with a structured prompt and falls back to parseResumeLocally.
 * - parseResume: Main exported function — chains extractResumeText → parseResumeWithGROQ and returns the result.
 * - class ResumeParserError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');
const pdfParse = require('pdf-parse');

const EMPTY_RESUME_RESPONSE = {
  skills: [],
  projects: [],
  experience: [],
  education: [],
  summary: ''
};

class ResumeParserError extends Error {
  constructor(message, statusCode = 500, code = 'RESUME_PARSER_ERROR') {
    super(message);
    this.name = 'ResumeParserError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Strips trailing commas and other common JSON format issues.
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
    throw new ResumeParserError('GROQ returned an empty response', 502, 'GROQ_INVALID_RESPONSE');
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
      throw new ResumeParserError(
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
    throw new ResumeParserError('Schema validation failure: Parsed data is not a valid object matching the resume schema', 422, 'SCHEMA_VALIDATION_FAILURE');
  }

  // If all major keys are missing, throw a schema validation failure
  const hasSomeKeys = ['skills', 'projects', 'experience', 'education', 'summary'].some(k => k in data);
  if (!hasSomeKeys) {
    throw new ResumeParserError('Schema validation failure: Parsed resume data is missing all required schema fields', 422, 'SCHEMA_VALIDATION_FAILURE');
  }

  const validated = {};

  // 1. skills
  if ('skills' in data) {
    if (Array.isArray(data.skills)) {
      validated.skills = normalizeStringArray(data.skills);
    } else if (typeof data.skills === 'string') {
      validated.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      validated.skills = [];
    }
  } else {
    validated.skills = [];
  }

  // 2. projects
  if ('projects' in data) {
    if (Array.isArray(data.projects)) {
      validated.projects = normalizeStringArray(data.projects);
    } else if (typeof data.projects === 'string') {
      validated.projects = [data.projects.trim()];
    } else {
      validated.projects = [];
    }
  } else {
    validated.projects = [];
  }

  // 3. experience
  if ('experience' in data) {
    if (Array.isArray(data.experience)) {
      validated.experience = normalizeStringArray(data.experience);
    } else if (typeof data.experience === 'string') {
      validated.experience = [data.experience.trim()];
    } else {
      validated.experience = [];
    }
  } else {
    validated.experience = [];
  }

  // 4. education
  if ('education' in data) {
    if (Array.isArray(data.education)) {
      validated.education = normalizeStringArray(data.education);
    } else if (typeof data.education === 'string') {
      validated.education = [data.education.trim()];
    } else {
      validated.education = [];
    }
  } else {
    validated.education = [];
  }

  // 5. summary
  if ('summary' in data) {
    validated.summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  } else {
    validated.summary = '';
  }

  return validated;
};

/**
 * Premium local text processing & regex parser (for offline / 429 quota failures).
 */
const parseResumeLocally = (resumeText) => {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  
  const skillDictionary = [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php',
    'html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask',
    'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'firebase', 'docker', 'aws',
    'git', 'github', 'graphql', 'rest', 'api', 'oops', 'dsa', 'system design'
  ];

  const skills = [];
  skillDictionary.forEach(skill => {
    const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'gi');
    const matches = resumeText.match(regex);
    if (matches && matches.length > 0) {
      const rawMatch = matches[0].trim();
      // Keep dictionary casing for nice visual output
      const matchedSkill = skillDictionary.find(s => s.toLowerCase() === rawMatch.toLowerCase()) || rawMatch;
      // Map to standard formatted name
      let formattedSkill = matchedSkill;
      if (matchedSkill === 'javascript') formattedSkill = 'JavaScript';
      if (matchedSkill === 'typescript') formattedSkill = 'TypeScript';
      if (matchedSkill === 'react') formattedSkill = 'React';
      if (matchedSkill === 'node') formattedSkill = 'Node.js';
      if (matchedSkill === 'express') formattedSkill = 'Express';
      if (matchedSkill === 'mongodb') formattedSkill = 'MongoDB';
      if (matchedSkill === 'postgresql') formattedSkill = 'PostgreSQL';
      if (matchedSkill === 'mysql') formattedSkill = 'MySQL';
      if (matchedSkill === 'graphql') formattedSkill = 'GraphQL';
      if (matchedSkill === 'oops') formattedSkill = 'OOPs';
      if (matchedSkill === 'dsa') formattedSkill = 'DSA';
      if (matchedSkill === 'system design') formattedSkill = 'System Design';

      if (!skills.includes(formattedSkill)) {
        skills.push(formattedSkill);
      }
    }
  });

  const projects = [];
  const experience = [];
  const education = [];

  let currentSection = 'summary';

  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('project') || lowerLine.includes('portfolio') || lowerLine.includes('personal work')) {
      currentSection = 'projects';
      return;
    }
    if (lowerLine.includes('experience') || lowerLine.includes('work history') || lowerLine.includes('employment') || lowerLine.includes('job')) {
      currentSection = 'experience';
      return;
    }
    if (lowerLine.includes('education') || lowerLine.includes('university') || lowerLine.includes('college') || lowerLine.includes('degree') || lowerLine.includes('school')) {
      currentSection = 'education';
      return;
    }
    if (lowerLine.includes('skill') || lowerLine.includes('technolog')) {
      currentSection = 'skills';
      return;
    }

    if (currentSection === 'projects') {
      if (line.length > 15 && line.length < 120 && !projects.includes(line)) {
        projects.push(line);
      }
    } else if (currentSection === 'experience') {
      if (line.length > 15 && line.length < 120 && !experience.includes(line)) {
        experience.push(line);
      }
    } else if (currentSection === 'education') {
      if (line.length > 10 && line.length < 100 && !education.includes(line)) {
        education.push(line);
      }
    }
  });

  // Fallbacks if section detection missed items
  if (projects.length === 0) {
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if ((lower.includes('build') || lower.includes('creat') || lower.includes('develop')) && lower.includes('project')) {
        if (line.length > 15 && line.length < 120) projects.push(line);
      }
    });
  }

  if (experience.length === 0) {
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if (lower.includes('engineer') || lower.includes('developer') || lower.includes('analyst') || lower.includes('intern')) {
        if (line.length > 15 && line.length < 120) experience.push(line);
      }
    });
  }

  if (education.length === 0) {
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if (lower.includes('bachelor') || lower.includes('master') || lower.includes('university') || lower.includes('college') || lower.includes('degree')) {
        if (line.length > 15 && line.length < 120) education.push(line);
      }
    });
  }

  let summary = '';
  const firstLines = lines.slice(0, 5).join(' ');
  if (firstLines.length > 30) {
    summary = firstLines.slice(0, 180) + '...';
  } else {
    summary = `Aspiring developer with capabilities in ${skills.slice(0, 4).join(', ') || 'software engineering'}. Proven problem solver.`;
  }

  return {
    skills: skills.slice(0, 15),
    projects: projects.slice(0, 5),
    experience: experience.slice(0, 5),
    education: education.slice(0, 3),
    summary: summary
  };
};

/**
 * Parses and extracts text from standard PDF buffers.
 */
const extractResumeText = async (fileBuffer) => {
  console.log(`[PDF Extraction] Input is Buffer: ${Buffer.isBuffer(fileBuffer)}, Size: ${fileBuffer ? fileBuffer.length : 0} bytes`);
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new ResumeParserError('Empty PDF content: No bytes received', 400, 'EMPTY_PDF_CONTENT');
    }
    const result = await pdfParse(fileBuffer);
    const resumeText = result?.text?.trim() || '';

    console.log(`[PDF Extraction] Extracted text length: ${resumeText.length}`);
    if (resumeText.length > 0) {
      console.log(`[PDF Extraction] First 500 characters of extracted text:\n${resumeText.slice(0, 500)}`);
    }

    if (!resumeText) {
      throw new ResumeParserError('Empty PDF content: Uploaded PDF does not contain readable text (blank or scanned)', 400, 'EMPTY_PDF_CONTENT');
    }

    return resumeText;
  } catch (error) {
    console.error('[PDF Extraction] Error parsing PDF:', error);
    if (error instanceof ResumeParserError) throw error;
    throw new ResumeParserError(`PDF extraction failed: ${error.message}`, 400, 'PDF_EXTRACTION_FAILED');
  }
};

/**
 * Requests GROQ to extract structured resume details. Fallback enabled.
 */
const parseResumeWithGROQ = async (resumeText) => {
  try {

    const prompt = `
You are a resume parser for CodeSangram's AI Interview Copilot.

Extract structured resume information from the text below.

Return ONLY valid JSON with this exact shape:
{
  "skills": [],
  "projects": [],
  "experience": [],
  "education": [],
  "summary": ""
}

Rules:
- "skills": Array of individual technical skills (e.g., ["React", "Node.js"]).
- "projects": Array of strings. Each string must summarize ONE entire project (Title, Tech, Description) in a single comprehensive paragraph. Do NOT split a single project into multiple fragmented array items.
- "experience": Array of strings. Each string must summarize ONE entire work experience (Company, Role, Duration, Achievements) comprehensively. Do NOT split a single role into multiple items.
- "education": Array of strings. Each string must summarize ONE entire degree or education credential.
- "summary": A 2-3 sentence professional summary of the candidate.
- Do not invent information.
- If a section is missing, return an empty array.

Resume text:
${resumeText.slice(0, 30000)}
`;

    const responseText = await generateContent({ prompt, jsonMode: true });
    
    // Log response details
    console.log('[GROQ Response] Request status: SUCCESS');
    console.log('[GROQ Response] Raw output:', responseText);

    if (!responseText) {
      throw new ResumeParserError('Invalid GROQ response: GROQ returned empty content', 502, 'GROQ_INVALID_RESPONSE');
    }

    const parsedData = extractJson(responseText);
    return validateAndProvideDefaults(parsedData);
  } catch (error) {
    // If it's a known non-GROQ API error (e.g. PDF extraction or Schema failure), propagate it
    if (error instanceof ResumeParserError && error.code !== 'JSON_PARSE_FAILURE') {
      console.warn(`⚠️ Resume parser error occurred: [${error.code}] ${error.message}`);
      throw error;
    }

    // For GROQ API errors (rate limits, 429s, network failures, etc.) or JSON parse failure, trigger premium local fallback
    console.warn("⚠️ GROQ API or JSON parsing failure, activating premium local fallback regex parser. Reason:", error.message);
    
    // Log details of the fallback trigger
    if (error instanceof ResumeParserError && error.code === 'JSON_PARSE_FAILURE') {
      console.warn('Fallback activated due to: JSON_PARSE_FAILURE');
    } else {
      console.warn('Fallback activated due to: GROQ_API_FAILURE');
    }

    return parseResumeLocally(resumeText);
  }
};

/**
 * Main parser entry point.
 */
const parseResume = async (fileBuffer) => {
  const resumeText = await extractResumeText(fileBuffer);
  const structuredData = await parseResumeWithGROQ(resumeText);

  return {
    ...EMPTY_RESUME_RESPONSE,
    ...structuredData
  };
};

module.exports = {
  ResumeParserError,
  extractResumeText,
  parseResumeWithGROQ,
  parseResume
};
