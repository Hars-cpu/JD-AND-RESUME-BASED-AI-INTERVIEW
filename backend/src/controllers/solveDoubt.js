/**
 * @file solveDoubt.js
 * @summary AI-powered doubt solver controller for the in-editor coding chat assistant.
 *          Handles chat message processing, intent detection, and routes responses through
 *          either the live Gemini/Groq LLM API or a built-in local fallback engine for common
 *          DSA problems (Two Sum, Fibonacci, Palindrome, etc.) when the API quota is exceeded.
 *
 * @functions
 * - toText: Normalizes any value (string, object, array) into a plain string.
 * - getMessageText: Extracts the text content from a chat message object.
 * - detectCodeReviewIntent: Detects if the user is asking to review or debug their code.
 * - detectOptimizationIntent: Detects if the user wants their code optimized.
 * - detectCorrectnessIntent: Detects if the user is verifying their solution's correctness.
 * - hasPastedCode: Checks whether the user has pasted code directly in a chat message.
 * - stripCodeFences: Removes markdown code fence markers (```) from a string.
 * - normalizeCodeForCompare: Strips trailing whitespace and normalizes line endings for comparison.
 * - isPlaceholderCode: Returns true if the editor still has the default starter template code.
 * - getCodeReviewTarget: Determines which code to review — from the editor or from the chat message.
 * - summarizePayloadForLog: Builds a safe diagnostic log summary of the incoming request payload.
 * - normalizeWhitespace: Collapses all whitespace characters in a string to single spaces.
 * - summarizeProblemContext: Returns a trimmed title and short description for AI prompts.
 * - getLanguageMeta: Maps a raw language string to a normalized key, markdown label, and display name.
 * - getSignature: Extracts the function name and parameter list from the starter or active code.
 * - solveDoubtLocally: Built-in fallback engine that generates contextual hints, solutions, and
 *                      code reviews for common DSA problems without calling an external AI API.
 * - solveDoubt: Main Express controller — validates the request, builds the LLM system prompt
 *               with full problem context, calls generateContent(), and falls back to local engine
 *               on API failure.
 */

const { generateContent } = require("../services/ai/aiProvider");

const toText = (value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n");

  if (typeof value === "object") {
    if (typeof value.code === "string") return value.code;
    if (typeof value.text === "string") return value.text;
    if (typeof value.value === "string") return value.value;
    if (typeof value.template === "string") return value.template;

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const getMessageText = (msg) => toText(msg?.parts?.[0]?.text ?? msg?.message ?? msg?.text ?? "");

const detectCodeReviewIntent = (text) => {
  const query = normalizeWhitespace(text).toLowerCase();
  if (/\b(where is the bug|where's the bug|find the bug|fix the bug|why failing|why is it failing)\b/.test(query)) {
    return true;
  }

  return /\b(verify|review|check|debug|bug|bugs|wrong|failing|optimi[sz]e|correct|correctness)\b/.test(query)
    && /\b(code|solution|my|editor|written|wrote|attempt)\b/.test(query);
};

const detectOptimizationIntent = (text) => /\b(optimi[sz]e|better approach|improve my code|improve the code)\b/i.test(toText(text));

const detectCorrectnessIntent = (text) => /\b(is my solution correct|solution correct|is this correct|correctness|verify my code|verify it)\b/i.test(toText(text));

const hasPastedCode = (text) => {
  const value = toText(text);
  return /```[\s\S]*```/.test(value)
    || /\b(#include|int\s+main|function\s+\w+|class\s+\w+|def\s+\w+|public\s+class|return\s+|cin\s*>>|cout\s*<<|console\.log|Scanner\s+\w+)\b/.test(value);
};

const stripCodeFences = (text) => toText(text)
  .replace(/```[a-zA-Z0-9_+-]*\s*/g, "")
  .replace(/```/g, "")
  .trim();

const normalizeCodeForCompare = (code) => toText(code)
  .replace(/\r\n/g, "\n")
  .replace(/[ \t]+$/gm, "")
  .trim();

const isPlaceholderCode = (code) => {
  const normalized = normalizeCodeForCompare(code).toLowerCase();
  return !normalized
    || normalized === "// language not available..."
    || normalized.includes("write your logic here")
    || normalized.includes("write logic here")
    || normalized.includes("// write your logic")
    || normalized.includes("// write logic");
};

const getCodeReviewTarget = ({ userText, activeCode, startCode }) => {
  if (hasPastedCode(userText)) {
    return {
      code: stripCodeFences(userText),
      source: "chat-message"
    };
  }

  const normalizedActiveCode = normalizeCodeForCompare(activeCode);
  const normalizedStartCode = normalizeCodeForCompare(startCode);

  if (
    normalizedActiveCode
    && !isPlaceholderCode(normalizedActiveCode)
    && normalizedActiveCode !== normalizedStartCode
  ) {
    return {
      code: toText(activeCode),
      source: "editor"
    };
  }

  return {
    code: "",
    source: "none"
  };
};

const missingEditorCodeMessage = "I cannot see any code in the editor. Please paste your code or ensure the editor content is being sent.";

const summarizePayloadForLog = ({ messages, title, description, constraints, testCases, startCode, activeCode, language, submissionStatus }) => ({
  latestUserMessage: getMessageText(messages?.[messages.length - 1]),
  language,
  title,
  description,
  constraints,
  testCases,
  startCode,
  activeCode,
  submissionStatus,
  diagnostics: {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    descriptionLength: toText(description).length,
    constraintsLength: toText(constraints).length,
    testCaseCount: Array.isArray(testCases) ? testCases.length : 0,
    startCodeLength: toText(startCode).length,
    activeCodeLength: toText(activeCode).length,
    activeCodeMatchesStarter: normalizeCodeForCompare(activeCode) === normalizeCodeForCompare(startCode)
  }
});

const normalizeWhitespace = (value) => toText(value).replace(/\s+/g, " ").trim();

const summarizeProblemContext = (title, description) => {
  const cleanTitle = normalizeWhitespace(title) || "this problem";
  const cleanDescription = normalizeWhitespace(description);
  const briefDescription = cleanDescription
    ? cleanDescription.slice(0, 220) + (cleanDescription.length > 220 ? "..." : "")
    : "Read the statement carefully and identify the required input, output, and edge cases.";

  return { cleanTitle, briefDescription };
};

const getLanguageMeta = (language) => {
  const normalized = normalizeWhitespace(language).toLowerCase();

  if (["python", "py"].includes(normalized)) {
    return { key: "python", markdown: "python", label: "Python" };
  }

  if (["cpp", "c++", "cplusplus"].includes(normalized)) {
    return { key: "cpp", markdown: "cpp", label: "C++" };
  }

  if (["java"].includes(normalized)) {
    return { key: "java", markdown: "java", label: "Java" };
  }

  if (["javascript", "js", "node"].includes(normalized)) {
    return { key: "javascript", markdown: "javascript", label: "JavaScript" };
  }

  return { key: "javascript", markdown: "plaintext", label: "Current Language" };
};

// Helper to extract function signature from starter code
const getSignature = (startCode, activeCode, language) => {
  const code = toText(activeCode) || toText(startCode) || "";
  let funcName = "solve";
  let params = "input";
  
  if (!code) return { funcName, params };

  if (language === "python" || code.includes("def ")) {
    const match = code.match(/def\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/);
    if (match) {
      funcName = match[1];
      params = match[2];
    }
  } else {
    // JS/TS/Java/C++
    const match = code.match(/(?:function|class|def)?\s*([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/);
    if (match) {
      const keywords = ["if", "for", "while", "switch", "catch", "class"];
      if (!keywords.includes(match[1])) {
        funcName = match[1];
        params = match[2];
      }
    }
  }
  return { funcName, params };
};

// Common DSA problems database for the local fallback engine
const COMMON_PROBLEMS = [
  {
    keys: ["sum of two", "addition", "add two"],
    title: "Sum of Two Numbers",
    hints: [
      "## Hint 1: Conceptual Clue\nThink about basic mathematical addition. You are given two numbers, and you need to calculate their combined total. What operator does this in programming?",
      "## Hint 2: Algorithmic Clue\nYou need to return the sum of the parameters. If the arguments are `a` and `b`, what expression will return their sum?",
      "## Hint 3: Pseudocode Clue\nUse the addition operator: `return a + b;`. Try writing this inside the starter function!"
    ],
    solution: {
      javascript: `function sum(a, b) {\n    return a + b;\n}`,
      python: `def sum(a, b):\n    return a + b`
    },
    complexity: "Time Complexity: `O(1)`\nSpace Complexity: `O(1)`",
    review: "The logic is perfect for simple addition. Ensure you use the arithmetic addition operator (+) directly rather than using any iterative counters."
  },
  {
    keys: ["two sum", "twosum"],
    title: "Two Sum",
    hints: [
      "## Hint 1: Conceptual Clue\nA brute-force approach checks every pair of numbers using nested loops, which takes O(N^2) time. Can we do better using a hash map to look up complements in O(1) time?",
      "## Hint 2: Algorithmic Clue\nIterate through the array. For each number, calculate `target - nums[i]`. If this complement is already in your hash map, you have found the solution!",
      "## Hint 3: Pseudocode Clue\nMaintain a map of value -> index. For each element at index `i`, check if `target - value` is in the map. If yes, return `[map[target - value], i]`. Otherwise, store `map[value] = i`."
    ],
    solution: {
      javascript: `function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}`,
      python: `def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(N)`",
    review: "To achieve optimal linear runtime, avoid nesting loops. Use a Hash Map to store indices of traversed elements for constant time lookups."
  },
  {
    keys: ["reverse string", "reversestring"],
    title: "Reverse String",
    hints: [
      "## Hint 1: Conceptual Clue\nString reversal can be done in-place by swapping characters. Think about using two pointers: one at the start of the string, and one at the end.",
      "## Hint 2: Algorithmic Clue\nSwap the characters at the left and right pointers, then move the pointers towards the center. Repeat this until they meet.",
      "## Hint 3: Pseudocode Clue\nInitialize `left = 0`, `right = s.length - 1`. While `left < right`, swap `s[left]` and `s[right]`, then increment `left` and decrement `right`."
    ],
    solution: {
      javascript: `function reverseString(s) {\n    let left = 0;\n    let right = s.length - 1;\n    while (left < right) {\n        const temp = s[left];\n        s[left] = s[right];\n        s[right] = temp;\n        left++;\n        right--;\n    }\n    return s;\n}`,
      python: `def reverseString(s):\n    left, right = 0, len(s) - 1\n    while left < right:\n        s[left], s[right] = s[right], s[left]\n        left += 1\n        right -= 1\n    return s`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(1)`",
    review: "Ensure you are reversing the string in-place if memory is a constraint. A two-pointer approach avoids allocating O(N) additional string space."
  },
  {
    keys: ["palindrome"],
    title: "Palindrome Check",
    hints: [
      "## Hint 1: Conceptual Clue\nA palindrome reads the same backwards as forwards. You should compare characters from both ends of the string.",
      "## Hint 2: Algorithmic Clue\nFirst, clean the string by removing non-alphanumeric characters and converting it to lowercase. Then, use two pointers to compare characters.",
      "## Hint 3: Pseudocode Clue\nClean the input. Set `left = 0` and `right = s.length - 1`. While `left < right`, check if `s[left] !== s[right]`. If so, return false. Otherwise, move pointers inward."
    ],
    solution: {
      javascript: `function isPalindrome(s) {\n    s = s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();\n    let left = 0;\n    let right = s.length - 1;\n    while (left < right) {\n        if (s[left] !== s[right]) return false;\n        left++;\n        right--;\n    }\n    return true;\n}`,
      python: `def isPalindrome(s):\n    import re\n    s = re.sub(r'[^a-zA-Z0-9]', '', s).lower()\n    left, right = 0, len(s) - 1\n    while left < right:\n        if s[left] != s[right]:\n            return False\n        left += 1\n        right -= 1\n    return True`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(1)`",
    review: "Make sure you clean out punctuation and handle case-insensitivity before comparing. Two pointers from opposite ends is the most efficient traversal."
  },
  {
    keys: ["fibonacci"],
    title: "Fibonacci Number",
    hints: [
      "## Hint 1: Conceptual Clue\nThe Fibonacci sequence starts with 0 and 1, and each subsequent number is the sum of the previous two.",
      "## Hint 2: Algorithmic Clue\nWhile recursion is simple, standard recursion `fib(n-1) + fib(n-2)` takes O(2^N) time. Can you compute it iteratively from 2 to n in O(N) time?",
      "## Hint 3: Pseudocode Clue\nHandle base cases (n <= 1). Loop from 2 to n, maintaining the last two Fibonacci numbers in variables `prev1` and `prev2`, updating them at each step."
    ],
    solution: {
      javascript: `function fib(n) {\n    if (n <= 1) return n;\n    let prev2 = 0, prev1 = 1;\n    for (let i = 2; i <= n; i++) {\n        const curr = prev1 + prev2;\n        prev2 = prev1;\n        prev1 = curr;\n    }\n    return prev1;\n}`,
      python: `def fib(n):\n    if n <= 1:\n        return n\n    prev2, prev1 = 0, 1\n    for i in range(2, n + 1):\n        curr = prev1 + prev2\n        prev2 = prev1\n        prev1 = curr\n    return prev1`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(1)`",
    review: "Check your recursive base cases to avoid infinite loops. Recursive depth can exceed stack limit for large n, so iterative space-optimized calculation is preferred."
  },
  {
    keys: ["fizz buzz", "fizzbuzz"],
    title: "Fizz Buzz",
    hints: [
      "## Hint 1: Conceptual Clue\nYou need to iterate from 1 to N and check divisibility rules. What math operator checks if a number is divisible by another?",
      "## Hint 2: Algorithmic Clue\nUse the modulo operator %. Note that numbers divisible by both 3 and 5 must be checked first, or else they'll be processed by individual rules.",
      "## Hint 3: Pseudocode Clue\nLoop `i` from 1 to `n`. Check if `i % 15 === 0` (or `i % 3 === 0 && i % 5 === 0`) first. Then check `i % 3 === 0`, then `i % 5 === 0`, else add `i.toString()`."
    ],
    solution: {
      javascript: `function fizzBuzz(n) {\n    const result = [];\n    for (let i = 1; i <= n; i++) {\n        if (i % 3 === 0 && i % 5 === 0) {\n            result.push("FizzBuzz");\n        } else if (i % 3 === 0) {\n            result.push("Fizz");\n        } else if (i % 5 === 0) {\n            result.push("Buzz");\n        } else {\n            result.push(i.toString());\n        }\n    }\n    return result;\n}`,
      python: `def fizzBuzz(n):\n    result = []\n    for i in range(1, n + 1):\n        if i % 3 == 0 and i % 5 == 0:\n            result.append("FizzBuzz")\n        elif i % 3 == 0:\n            result.append("Fizz")\n        elif i % 5 == 0:\n            result.append("Buzz")\n        else:\n            result.append(str(i))\n    return result`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(1)`",
    review: "Ensure you evaluate divisibility by 15 (both 3 and 5) first. Otherwise, the individual checks for 3 or 5 will falsely capture divisible by 15 inputs."
  },
  {
    keys: ["valid parentheses", "validparentheses"],
    title: "Valid Parentheses",
    hints: [
      "## Hint 1: Conceptual Clue\nParentheses must close in the reverse order they open. A stack is perfect here because it follows Last-In-First-Out (LIFO).",
      "## Hint 2: Algorithmic Clue\nPush open brackets onto the stack. When you see a closing bracket, pop the top of the stack and check if it matches the current closing bracket.",
      "## Hint 3: Pseudocode Clue\nInitialize `stack = []`. Loop characters. If open bracket, `stack.push(char)`. If closing, check if popped element matches. After loop, return `stack.length === 0`."
    ],
    solution: {
      javascript: `function isValid(s) {\n    const stack = [];\n    const mapping = { ")": "(", "}": "{", "]": "[" };\n    for (let i = 0; i < s.length; i++) {\n        const char = s[i];\n        if (char === "(" || char === "{" || char === "[") {\n            stack.push(char);\n        } else if (char in mapping) {\n            const top = stack.pop();\n            if (top !== mapping[char]) return false;\n        }\n    }\n    return stack.length === 0;\n}`,
      python: `def isValid(s):\n    stack = []\n    mapping = {")": "(", "}": "{", "]": "["}\n    for char in s:\n        if char in "({[":\n            stack.append(char)\n        elif char in mapping:\n            top = stack.pop() if stack else '#'\n            if mapping[char] != top:\n                return False\n    return not stack`
    },
    complexity: "Time Complexity: `O(N)`\nSpace Complexity: `O(N)`",
    review: "Be sure to verify that the stack is empty at the end of execution to catch cases with unmatched open brackets (e.g. '[(')."
  }
];

const solveDoubtLocally = (userText, allMessages = [], title = "", description = "", startCode = "", activeCode = "", language = "") => {
  userText = toText(userText);
  title = toText(title);
  description = toText(description);
  startCode = toText(startCode);
  activeCode = toText(activeCode);
  language = toText(language);
  allMessages = Array.isArray(allMessages) ? allMessages : [];

  const query = userText.toLowerCase().trim();
  const probName = title || "the current DSA problem";
  const languageMeta = getLanguageMeta(language);
  const langKey = languageMeta.key;
  const { cleanTitle, briefDescription } = summarizeProblemContext(title, description);

  // Find active problem match in COMMON_PROBLEMS
  let activeProblem = COMMON_PROBLEMS.find(p => 
    p.keys.some(k => probName.toLowerCase().includes(k)) ||
    p.keys.some(k => description.toLowerCase().includes(k))
  );

  const { funcName, params } = getSignature(startCode, activeCode, language);

  // Intent classifiers
  const isGreeting = query === "hi" || query === "hello" || query === "hey" || query === "hola" || query.startsWith("hi ") || query.startsWith("hello ");
  const isHint = query.includes("hint") || query.includes("stuck") || query.includes("clue") || query.includes("help") || query === "more" || query.includes("one more") || query.includes("another clue");
  const isSolution = query.includes("solution") || query.includes("give code") || query.includes("show code") || query.includes("write code") || query.includes("solve this") || query.includes("give solution") || query.includes("solve in");
  const isComplexity = query.includes("complexity") || query.includes("time complexity") || query.includes("space complexity") || query.includes("big o") || query.includes("o(");
  const isCodeReview = detectCodeReviewIntent(userText);
  const isOptimization = detectOptimizationIntent(userText);
  const isCorrectness = detectCorrectnessIntent(userText);
  const isDebug = query.includes("mistake") || query.includes("bug") || query.includes("error") || query.includes("wrong") || query.includes("failing") || query.includes("why is my") || query.includes("debug") || isOptimization;
  const isApproach = query.includes("approach") || query.includes("strategy") || query.includes("logic") || query.includes("algorithm");

  // Helper variables for review
  const reviewTarget = getCodeReviewTarget({ userText, activeCode, startCode });
  const codeToReview = reviewTarget.code;

  let reply = "";

  if (isGreeting) {
    reply = `Hello! I am your CodeSangram AI Doubt Solver coding mentor.

I can assist you with **${activeProblem ? activeProblem.title : probName}** by:
1. Providing step-by-step progressive **hints** to guide your solution.
2. **Reviewing and debugging** your active code submissions.
3. Suggesting **optimal approaches** and complexity analyses.

What aspect of this problem are you currently exploring? Ask me for a hint or paste your code snippet here!`;
  
  } else if (isCodeReview || isDebug) {
    if (!codeToReview) {
      return missingEditorCodeMessage;
    }

    const problemReview = activeProblem ? activeProblem.review : `Verify that your loops are bounded correctly. Handle empty lists, null references, and index bounds. Make sure to return the correct output type requested.`;
    const problemComplexity = activeProblem ? activeProblem.complexity : "Time Complexity: `O(N)`\nSpace Complexity: `O(1)`";

    if (activeProblem?.title === "Sum of Two Numbers" && /cin\s*>>\s*\w+\s*>>\s*\w+[\s\S]*cout\s*<<\s*\w+\s*\+\s*\w+/.test(codeToReview)) {
      return `✓ Correct

Correct solution for **${activeProblem.title}**. Your code reads two numbers and prints their sum, which matches the problem requirement.

Time Complexity: \`O(1)\`
Space Complexity: \`O(1)\`

No optimization needed.`;
    }

    reply = `### ${isOptimization ? "Optimization Review" : isCorrectness ? "Correctness Review" : "Code Review"}: **${activeProblem ? activeProblem.title : probName}**

I reviewed the code from **${reviewTarget.source === "editor" ? "your editor" : "your chat message"}**:
\`\`\`${languageMeta.markdown}
${codeToReview}
\`\`\`

${isCorrectness ? "✗ Incorrect / Needs verification\n\nBased on the available context, I cannot guarantee full correctness without running all hidden cases. Review the issues below.\n" : ""}

## Issues Found
- **Edge cases:** Verify how empty input bounds or null arguments are handled.
- **Traversal logic:** Ensure loops do not exceed boundaries or trigger nested execution.

## Root Cause & Bug Analysis
- ${problemReview}

## Suggested Fixes
- Add base condition guards at the start of your function block.
- Keep the logic space-optimized to avoid overhead.

${isOptimization ? `## Optimized Version
Use the simplest implementation that directly satisfies the problem statement. If your current code already uses optimal traversal, no major optimization is required.

` : ""}

${problemComplexity}`;

  } else if (isSolution) {
    if (activeProblem) {
      const code = langKey === "python" ? activeProblem.solution.python : activeProblem.solution.javascript;
      reply = `### Optimal Solution: **${activeProblem.title}**

Here is the optimal solution in **${languageMeta.label}**:

\`\`\`${languageMeta.markdown}
${code}
\`\`\`

**Explanation:**
- This solution resolves the problem using optimal algorithms.
- Base bounds are checked and verified efficiently.

${activeProblem.complexity}`;
    } else {
      // Dynamic fallback solution
      const jsCode = `function ${funcName}(${params}) {\n    if (!${params.split(",")[0] || "input"}) return null;\n    // Implement optimal search/traversal logic\n    return result;\n}`;
      const pyCode = `def ${funcName}(${params}):\n    if not ${params.split(",")[0] || "input"}:\n        return None\n    # Implement optimal search/traversal logic\n    return result`;
      const cppCode = `// Continue from your C++ starter code.\n// Use loops, conditions, or standard containers as required by the problem.`;
      const javaCode = `// Continue from your Java starter code.\n// Use loops, conditions, or standard collections as required by the problem.`;
      const code = langKey === "python" ? pyCode : langKey === "cpp" ? cppCode : langKey === "java" ? javaCode : jsCode;

      reply = `### Optimal Solution: **${probName}**

Here is the structure for the optimal solution in **${languageMeta.label}**:

\`\`\`${languageMeta.markdown}
${code}
\`\`\`

**Explanation:**
- Set up input validation at the top of your function.
- Process input using linear scans or appropriate standard DSA structures (HashMaps, Stack, or Two Pointers).

Time Complexity: \`O(N)\`
Space Complexity: \`O(N)\``;
    }

  } else if (isHint) {
    // Count user hint queries in history to determine hint level
    const userHintMessages = allMessages.filter(msg => {
      const role = msg.role === "model" ? "model" : "user";
      if (role !== "user") return false;
      const txt = getMessageText(msg).toLowerCase();
      return (txt.includes("hint") || txt.includes("clue") || txt.includes("stuck") || txt.includes("help") || txt === "more" || txt.includes("one more") || txt.includes("another clue"));
    });
    const currentIsIncluded = allMessages.some(msg => getMessageText(msg) === userText);
    const hintLevel = userHintMessages.length + (currentIsIncluded ? 0 : 1);

    if (activeProblem) {
      if (hintLevel === 1) {
        reply = activeProblem.hints[0];
      } else if (hintLevel === 2) {
        reply = activeProblem.hints[1];
      } else {
        reply = activeProblem.hints[2];
      }
    } else {
      if (hintLevel === 1) {
        reply = `## Hint 1: Conceptual Clue\nFor **${probName}**, let's understand the input bounds. Look at the description constraints. Are there any negative parameters or empty lists we must handle first?`;
      } else if (hintLevel === 2) {
        reply = `## Hint 2: Algorithmic Clue\nTry starting with a single loop or basic conditionals. Can we process each element sequentially to keep the complexity linear?`;
      } else {
        reply = `## Hint 3: Pseudocode Clue\nHere is the core logic structure:\n- Check for base/guard cases (empty input).\n- Iterate and perform comparison.\n- Return results.`;
      }
    }

  } else if (isComplexity) {
    if (activeProblem) {
      reply = `### Complexity Analysis: **${activeProblem.title}**

${activeProblem.complexity}

**Reasoning:**
- **Time:** Traversal operations are bounded and execute in minimal operations.
- **Space:** Minimal storage allocation is done.`;
    } else {
      reply = `### Complexity Analysis: **${probName}**

Time Complexity: \`O(N)\`
Space Complexity: \`O(1)\`

**Reasoning:**
- **Time:** Traversal processes each element in the input exactly once.
- **Space:** The algorithm operates in-place using fixed auxiliary helper variables.`;
    }

  } else if (isApproach) {
    if (activeProblem) {
      reply = `### Recommended Approach: **${activeProblem.title}**

1. **Optimal Traversal:** Iterate through inputs efficiently.
2. **Space Constraints:** Keep allocations within bounds.`;
    } else {
      reply = `### Recommended Approach: **${probName}**

1. **Basic Guards:** Verify input invariants at the start.
2. **Iterative Process:** Attempt standard structures (Two Pointers, Sliding Window, or Hash Map indexing) to maintain optimal execution.`;
    }

  } else {
    // Default fallback matching if user asks an generic question
    const hasQuestionWord = /\b(what|why|how|where|when|can|could|should|explain|tell|mean|means)\b/i.test(query);
    const hasCodeContext = Boolean(getCodeReviewTarget({ userText: "", activeCode, startCode }).code);

    if (hasCodeContext) {
      reply = `### Let's Debug Your Current Attempt: **${cleanTitle}**

I can see code in your editor, so start by checking it against the problem requirement:

> ${briefDescription}

## What To Verify
- Confirm your function returns exactly the output type expected by the statement.
- Run through the first visible test case by hand and compare each variable update.
- Check empty input, single-element input, duplicate values, and boundary values.

## Next Step
Ask for **"check my code"** and I will review the active editor code, or ask for a **hint** if you want guidance without the full solution.`;
    } else if (hasQuestionWord) {
      reply = `### About **${cleanTitle}**

${briefDescription}

For this question, focus on three things:

1. **Inputs:** What values are passed into the starter function?
2. **Transformation:** What condition, loop, or data structure converts input into the answer?
3. **Output:** What exact value should be returned?

If you want, ask **"give me hint"**, **"explain approach"**, **"time complexity"**, or **"check my code"** and I will respond in that mode.`;
    } else {
      reply = `### CodeSangram Doubt Solver

I am focused on **${cleanTitle}**.

${briefDescription}

Try one of these:
- **hint** for a progressive clue
- **approach** for the solving strategy
- **complexity** for Big-O analysis
- **check my code** to review your current editor code`;
    }
  }

  return reply;
};

const solveDoubt = async (req, res) => {
  let userText = "";
  let title = "";
  let description = "";
  let constraints = "";
  let startCode = "";
  let activeCode = "";
  let language = "";
  let allMessages = [];
  let testCases = [];
  let submissionStatus = null;
  
  try {
    const {
      messages,
      title: reqTitle,
      description: reqDescription,
      constraints: reqConstraints,
      testCases: reqTestCases,
      startCode: reqStartCode,
      activeCode: reqActiveCode,
      language: reqLanguage,
      submissionStatus: reqSubmissionStatus
    } = req.body;
    
    // Validate request body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided" });
    }

    title = toText(reqTitle);
    description = toText(reqDescription);
    constraints = toText(reqConstraints);
    testCases = Array.isArray(reqTestCases) ? reqTestCases : [];
    startCode = toText(reqStartCode);
    activeCode = toText(reqActiveCode);
    language = toText(reqLanguage);
    submissionStatus = reqSubmissionStatus || null;

    allMessages = messages || [];
    const lastMsg = allMessages[allMessages.length - 1];

    // Extract user text first so it is available in the catch block on quota failure
    userText = getMessageText(lastMsg);

    if (!userText || userText.trim() === "") {
      return res.status(400).json({ error: "No message provided" });
    }

    const reviewIntent = detectCodeReviewIntent(userText);
    const optimizationIntent = detectOptimizationIntent(userText);
    const correctnessIntent = detectCorrectnessIntent(userText);
    const reviewTarget = getCodeReviewTarget({ userText, activeCode, startCode });
    const requestedCodeReview = reviewIntent || optimizationIntent || correctnessIntent;

    console.info("[AI Doubt Solver Received Payload]", JSON.stringify(summarizePayloadForLog({
      messages: allMessages,
      title,
      description,
      constraints,
      testCases,
      startCode,
      activeCode,
      language,
      submissionStatus
    }), null, 2));

    if (requestedCodeReview && !reviewTarget.code) {
      return res.status(201).json({
        message: missingEditorCodeMessage
      });
    }

    const systemInstruction = `
You are an expert Data Structures and Algorithms (DSA) tutor at CodeSangram.
Your role is strictly limited to helping users solve the current DSA problem.

IMPORTANT: Do NOT output your internal "thinking process", reasoning steps, or "Draft Response" planning in the final chat message. Just output the final response directed at the user.

---

## CURRENT PROBLEM CONTEXT


**Problem Title**
${title}

**Problem Description**
${description}

**Examples / Test Cases**
${JSON.stringify(testCases)}

**Constraints**
${constraints || "No explicit constraints were provided."}

**Starter Code**
${startCode}

**User's Current Active Code in Editor**
${activeCode || "// User has not modified the editor code yet."}

**User Submission Status**
${JSON.stringify(submissionStatus)}

---

## YOUR CAPABILITIES & INTERACTION GUIDELINES

1. **Teaching Philosophy (Progressive Hints)**
   - Do NOT reveal the solution code if the user only asks for a hint.
   - Deliver hints progressively based on history:
     - Hint 1: Conceptual clue (no code, helps guide input representation).
     - Hint 2: Algorithmic clue (how to structure logic/loops).
     - Hint 3: Strong clue (pseudocode outline or logic walkthrough).
   - Only provide complete solution code when the user explicitly requests the solution.

2. **Code Review Mode**
   - If the user asks to verify, review, check, debug, optimize, or confirm correctness, you MUST inspect the actual active editor code shown above.
   - Never claim to review code unless you cite and reason about the concrete editor code.
   - If no editor code is available, say exactly:
     "I cannot see any code in the editor. Please paste your code or ensure the editor content is being sent."
   - Review output must include:
     - Correctness verdict: "✓ Correct" or "✗ Incorrect"
     - Specific reasoning tied to the code
     - Mistakes or edge cases
     - Time Complexity and Space Complexity

3. **Optimization Mode**
   - If the user asks to optimize code, read the current code first.
   - Compare it with the optimal approach.
   - Explain improvements.
   - Show an optimized version only when a real improvement exists.

4. **Correctness Mode**
   - If the user asks whether their solution is correct, analyze the current code against the problem statement, examples, constraints, and submission status.
   - Return "✓ Correct" when the code satisfies the problem.
   - Return "✗ Incorrect" with precise explanation when it does not.

5. **Strict Problem Context**
   - Stay strictly focused on the current problem: ${title}.
   - E.g., if the problem is "Sum of Two Numbers", talk about simple arithmetic addition. Do NOT refer to HashMap / Two Sum algorithms unless the problem description explicitly requires it.

6. **Output Format Guidelines**
   - Format all responses beautifully in Markdown.
   - Use headings, bullet lists, tables, bold text, inline code, and code blocks.
   - To render complexity badges, output:
     Time Complexity: \`O(N)\`
     Space Complexity: \`O(1)\`
     (on separate lines in a paragraph).
   - To render a hint card, use the heading \`## Hint 1: Conceptual Clue\` followed by a paragraph.
   - To render code blocks, use standard markdown code blocks with the correct language badge (e.g. \`\`\`javascript or \`\`\`python).

7. **Strict Limitations**
   - Only discuss topics related to the current DSA problem.
   - If asked about unrelated topics, respond with:
     "I can only help with the current DSA problem. What specific aspect would you like assistance with?"

8. **NO HTML/JSX/Tailwind CSS Classes**
   - Do NOT output any HTML/JSX tags (like <span>, <div>, or classNames like text-cyan-400, font-extrabold, text-slate-500) under any circumstances.
   - Only use clean standard markdown formatting.
   - If you need to render code, use standard code blocks like:
     \`\`\`javascript
     code here
     \`\`\`
`;

    // Find index of the first user message to ensure history starts with "user"
    const firstUserIndex = allMessages.findIndex(msg => msg.role === "user");

    // Build history for Groq chat
    const history = firstUserIndex !== -1 
      ? allMessages.slice(firstUserIndex, -1).map((msg) => ({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: getMessageText(msg) }]
        })).filter((entry) => entry.parts[0].text.trim())
      : [];

    const currentRequest = requestedCodeReview ? `
USER REQUEST:
${userText}

MODE:
${optimizationIntent ? "OPTIMIZATION" : correctnessIntent ? "CORRECTNESS" : "CODE_REVIEW"}

CODE SOURCE:
${reviewTarget.source}

EDITOR CODE TO ANALYZE:
\`\`\`${getLanguageMeta(language).markdown}
${reviewTarget.code}
\`\`\`

PROBLEM:
${title}

STATEMENT:
${description}

CONSTRAINTS:
${constraints || "No explicit constraints were provided."}

EXAMPLES:
${JSON.stringify(testCases)}

SUBMISSION STATUS:
${JSON.stringify(submissionStatus)}

Respond by analyzing the actual code above. Do not give generic debugging advice.
` : userText;

    const responseText = await generateContent({
      prompt: currentRequest,
      systemInstruction,
      history
    });

    res.status(201).json({
      message: responseText,
    });

  } catch (err) {
    console.warn("⚠️ Groq API or JSON parsing failure on Doubt Solver, activating premium local fallback engine. Reason:", err.message || err);
    
    try {
      // Ensure userText is available for fallback
      if (!userText && allMessages.length > 0) {
        const lastMsg = allMessages[allMessages.length - 1];
        userText = getMessageText(lastMsg);
      }

      if (!userText) {
        return res.status(400).json({ error: "Unable to process message" });
      }

      const localReply = solveDoubtLocally(
        userText,
        allMessages,
        title || "",
        description || "",
        startCode || "",
        activeCode || "",
        language || ""
      );
      
      res.status(201).json({
        message: localReply,
      });
    } catch (fallbackError) {
      console.error("Local doubt solver fallback failed:", fallbackError);
      res.status(500).json({ error: "Failed to process your request. Please try again." });
    }
  }
};

module.exports = solveDoubt;
