/**
 * Judge0 Code Execution Utilities
 * 
 * This file provides helper functions to interface with the RapidAPI Judge0 compiler API:
 * 1. Mapping compiler names (e.g. cpp, java, javascript) to Judge0 language IDs.
 * 2. Compiling and batching code inputs into base64 payload strings for transmission.
 * 3. Polling and retrieving execution results asynchronously via tokens, including automatic base64 output decoding.
 */

const axios = require('axios');
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'judge0-extra-ce1.p.rapidapi.com';

/**
 * Maps a language string identifier to its corresponding Judge0 API language ID.
 * 
 * @param {string} lang - The string name of the compiler (e.g. 'js', 'java', 'cpp')
 * @returns {number|undefined} The corresponding Judge0 language ID integer, or undefined if unsupported
 */
const getLanguageById = (lang) => {
    if (!lang) return undefined;
    const lower = lang.toLowerCase();
    
    // Lookup mapping for supported languages
    const language = {
        "cpp": 54,        // C++ (GCC 9.2.0)
        "c++": 54,
        "java": 62,       // Java (OpenJDK 13.0.1)
        "javascript": 63, // JavaScript (Node.js 12.14.0)
        "js": 63
    }

    return language[lower];
}

/**
 * Prepares and submits a batch of code solutions to the Judge0 compiler server.
 * 
 * Sanitizes parameters, encodes source code, stdin, and expected output to base64
 * (to prevent transmission character loss), and posts to the RapidAPI Judge0 batch endpoint.
 * 
 * @param {Array<Object>} submissions - Array of submissions containing source_code, language_id, stdin, and expected_output
 * @returns {Promise<Array<Object>>} Promise resolving to the list of execution tracking tokens
 */
const submitBatch = async (submissions) => {
  // Map fields and convert strings to base64 format before submission
  const b64Submissions = submissions.map(sub => ({
    ...sub,
    source_code: sub.source_code ? Buffer.from(sub.source_code).toString('base64') : null,
    stdin: sub.stdin ? Buffer.from(sub.stdin).toString('base64') : null,
    expected_output: sub.expected_output ? Buffer.from(sub.expected_output).toString('base64') : null
  }));

  const options = {
    method: 'POST',
    url: `https://${JUDGE0_HOST}/submissions/batch`,
    params: {
      base64_encoded: 'true'
    },
    headers: {
      'x-rapidapi-key': process.env.JUDGE0_KEY,
      'x-rapidapi-host': JUDGE0_HOST,
      'Content-Type': 'application/json'
    },
    data: {
      submissions: b64Submissions
    }
  };

  /**
   * Helper function making the actual batch request.
   */
  async function fetchData() {
      try {
          const response = await axios.request(options);
          return response.data;
      } catch (error) {
          console.error("Error communicating with Judge0 (Batch):", error.message || error);
          throw error;
      }
  }

  return await fetchData();
}

/**
 * Creates a promise-based delay used during token polling cycles.
 * 
 * @param {number} timer - Time to delay in milliseconds
 * @returns {Promise<void>}
 */
const waiting = (timer) => {
  return new Promise(resolve => setTimeout(resolve, timer));
}

/**
 * Polls the execution status of a batched submission from Judge0 using tracking tokens.
 * 
 * Queries Judge0 up to 25 times (waiting 1 second between attempts). Once all submission
 * tasks transition out of pending (status_id > 2), it decodes their outputs (stdout, compile_output, etc.)
 * from base64 back into plaintext UTF-8.
 * 
 * @param {Array<string>} resultToken - Array of string tracking tokens from Judge0
 * @returns {Promise<Array<Object>>} Decoded details of test execution reports
 */
const submitToken = async (resultToken) => {
  if (!resultToken || !Array.isArray(resultToken) || resultToken.length === 0) {
    throw new Error("No tokens provided for result fetching");
  }
  const options = {
    method: 'GET',
    url: `https://${JUDGE0_HOST}/submissions/batch`,
    params: {
      tokens: resultToken.join(","),
      base64_encoded: 'true',
      fields: '*'
    },
    headers: {
      'x-rapidapi-key': process.env.JUDGE0_KEY,
      'x-rapidapi-host': JUDGE0_HOST
    }
  };

  /**
   * Helper function fetching raw execution statuses.
   */
  async function fetchData() {
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error("Error communicating with Judge0:", error.message || error);
      throw error;
    }
  }

  // Poll for completion (up to 25 attempts, 1 second intervals)
  for (let attempt = 0; attempt < 25; attempt++) {
    const result = await fetchData();
    if (!result || !result.submissions) {
      await waiting(1000);
      continue;
    }

    // Check if every submission has finished executing (status_id > 2 indicates complete)
    const IsResultObtained = result.submissions.every((r) => r && r.status_id > 2);  
    if (IsResultObtained) {
      // Decode base64 responses back to plaintext strings
      const decodedSubmissions = result.submissions.map((sub) => {
        if (!sub) return null;
        const decode = (val) => val ? Buffer.from(val, 'base64').toString('utf-8') : val;
        return {
          ...sub,
          stdout: decode(sub.stdout),
          stderr: decode(sub.stderr),
          compile_output: decode(sub.compile_output),
          message: decode(sub.message),
          stdin: decode(sub.stdin),
          expected_output: decode(sub.expected_output)
        };
      });
      return decodedSubmissions;
    }
    await waiting(1000);
  }
  throw new Error("Judge0 execution timed out after 25 seconds");
}

module.exports = { getLanguageById, submitBatch, submitToken };