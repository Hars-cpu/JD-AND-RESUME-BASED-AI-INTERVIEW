/**
 * @file userProblem.js
 * @summary Coding Problems and Submissions Controller. Handles problem administration workflows 
 *          (creating, editing, and deleting problems) and candidate workspace utilities
 *          (listing, querying, viewing completed submissions, and tracking unsolved/attempted issues).
 * 
 * @functions
 * - createProblem: (Admin) Validates reference solutions via Judge0, then creates a new MongoDB challenge schema.
 * - updateProblem: (Admin) Re-verifies reference code correctness, then updates MongoDB document options.
 * - deleteProblem: (Admin) Purges problem schemas from the MongoDB collection.
 * - getProblemById: (Both) Queries a single challenge and aggregates Cloudinary video explanation attachments if present.
 * - getAllProblem: (Both) Fetches a lightweight subset of problem details (title, tags, difficulty) for list indexing.
 * - solvedAllProblemByUser: (User) Populates complete lists of challenges solved successfully by the candidate.
 * - submittedProblem: (User) Queries candidate execution runs history for a specific problem ID.
 * - getAttemptedProblems: (User) Compares submission histories against completed lists to return attempted-but-unsolved problems.
 */

const { getLanguageById, submitBatch, submitToken } = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const Submission = require("../models/submission");
const SolutionVideo = require("../models/solutionVideo");

/**
 * Creates a new DSA problem after validating reference solutions.
 * 
 * Submits the admin's reference solutions with visible test cases to Judge0. 
 * If all test cases yield an 'Accepted' (status_id: 3) response, the problem is saved to MongoDB.
 * 
 * @param {Object} req - Express request containing problem attributes (title, description, testcases, etc.)
 * @param {Object} res - Express response
 */
const createProblem = async (req, res) => {
  const { title, description, difficulty, tags,
    visibleTestCases, hiddenTestCases, startCode,
    referenceSolution, problemCreator
  } = req.body;
  try {
    // Iterate over reference solutions to validate correctness using Judge0 API
    for (const { language, completeCode } of referenceSolution) {
      const languageId = getLanguageById(language);
      
      // Clean inputs for string/compiled languages (stripping quotes if necessary)
      const cleanInput = (val) => {
        if (language === 'cpp' || language === 'java') {
          if (val.startsWith('"') && val.endsWith('"')) {
            return val.slice(1, -1);
          }
        }
        return val;
      };
        
      // Combine test cases for validation
      const allTestCases = [...(visibleTestCases || []), ...(hiddenTestCases || [])];
        
      // Map test cases to Judge0 batch format
      const submissions = allTestCases.map((testcase) => ({
        source_code: completeCode,
        language_id: languageId,
        stdin: cleanInput(testcase.input),
        expected_output: testcase.output
      }));

      // Submit reference code to Judge0 for evaluation
      const submitResult = await submitBatch(submissions);
      const resultToken = submitResult.map((value) => value.token);
      
      // Poll execution status tokens from Judge0
      const testResult = await submitToken(resultToken);

      // Verify that all test cases passed (Status ID 3 corresponds to 'Accepted')
      for (const test of testResult) {
        if (test.status_id != 3) {
          const expectedStr = String(test.expected_output || '').trim();
          const actualStr = String(test.stdout || '').trim();
          const detail = test.compile_output || test.stderr || `Output mismatch. Expected: "${expectedStr}" but got: "${actualStr}"`;
          return res.status(400).send(`Judge0 Validation Error: ${detail}`);
        }
      }
    }

    // Save problem to database, attributing creator permissions to logged-in administrator
    const userProblem = await Problem.create({
      ...req.body,
      problemCreator: req.result._id
    });

    res.status(201).send("Problem Saved Successfully");
  } catch (err) {
    res.status(400).send("Error: " + err);
  }
}

/**
 * Updates an existing DSA problem.
 * 
 * Re-validates updated reference solutions against updated visible test cases on Judge0. 
 * If valid, updates Mongoose schema parameters.
 * 
 * @param {Object} req - Express request containing problem update parameters and ID in params
 * @param {Object} res - Express response
 */
const updateProblem = async (req, res) => {
  const { id } = req.params;
  const { title, description, difficulty, tags,
    visibleTestCases, hiddenTestCases, startCode,
    referenceSolution, problemCreator
  } = req.body;

  try {
    if (!id) {
      return res.status(400).send("Missing ID Field");
    }

    const DsaProblem = await Problem.findById(id);
    if (!DsaProblem) {
      return res.status(404).send("ID is not present in server");
    }
      
    // Re-verify solutions with Judge0
    for (const { language, completeCode } of referenceSolution) {
      const languageId = getLanguageById(language);
      
      const cleanInput = (val) => {
        if (language === 'cpp' || language === 'java') {
          if (val.startsWith('"') && val.endsWith('"')) {
            return val.slice(1, -1);
          }
        }
        return val;
      };
        
      const allTestCases = [...(visibleTestCases || []), ...(hiddenTestCases || [])];
        
      const submissions = allTestCases.map((testcase) => ({
        source_code: completeCode,
        language_id: languageId,
        stdin: cleanInput(testcase.input),
        expected_output: testcase.output
      }));

      const submitResult = await submitBatch(submissions);
      const resultToken = submitResult.map((value) => value.token);
      const testResult = await submitToken(resultToken);

      for (const test of testResult) {
        if (test.status_id != 3) {
          const expectedStr = String(test.expected_output || '').trim();
          const actualStr = String(test.stdout || '').trim();
          const detail = test.compile_output || test.stderr || `Output mismatch. Expected: "${expectedStr}" but got: "${actualStr}"`;
          return res.status(400).send(`Judge0 Validation Error: ${detail}`);
        }
      }
    }

    // Apply updates with validator checks enabled
    const newProblem = await Problem.findByIdAndUpdate(id, { ...req.body }, { runValidators: true, new: true });
     
    res.status(200).send(newProblem);
  } catch (err) {
    res.status(500).send("Error: " + err);
  }
}

/**
 * Deletes a DSA problem from the database by ID.
 * 
 * @param {Object} req - Express request containing the target problem ID in params
 * @param {Object} res - Express response
 */
const deleteProblem = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) {
      return res.status(400).send("ID is Missing");
    }

    const deletedProblem = await Problem.findByIdAndDelete(id);

    if (!deletedProblem) {
      return res.status(404).send("Problem is Missing");
    }

    res.status(200).send("Successfully Deleted");
  } catch (err) {
    res.status(500).send("Error: " + err);
  }
}

/**
 * Retrieves a single problem by ID.
 * 
 * Combines the basic problem attributes with video solution details (CDN URL, thumbnails,
 * duration) if a video solution exists for this challenge.
 * 
 * @param {Object} req - Express request containing the target problem ID in params
 * @param {Object} res - Express response
 */
const getProblemById = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) {
      return res.status(400).send("ID is Missing");
    }

    const getProblem = await Problem.findById(id);
    if (!getProblem) {
      return res.status(404).send("Problem is Missing");
    }

    // Lookup video explanation attachment
    const video = await SolutionVideo.findOne({ problemId: id });
    if (video) {
      const responseData = {
        ...getProblem.toObject(),
        secureUrl: video.secureUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
      } 
      return res.status(200).send(responseData);
    }

    res.status(200).send(getProblem);
  } catch (err) {
    res.status(500).send("Error: " + err);
  }
}  

/**
 * Fetches lightweight summary metadata of all available coding problems.
 * 
 * Returns only ID, title, difficulty, and tags to keep initial list loading snappy.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getAllProblem = async (req, res) => {
  try {
    const getProblem = await Problem.find({}).select('_id title difficulty tags');

    res.status(200).send(getProblem || []);
  } catch (err) {
    res.status(500).send("Error: " + err);
  }
}

/**
 * Retrieves all problems solved successfully by the logged-in candidate.
 * 
 * Populates details of resolved problems from the candidate's User schema.
 * 
 * @param {Object} req - Express request containing candidate profile in req.user
 * @param {Object} res - Express response
 */
const solvedAllProblemByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate({
      path: 'problemSolved',
      select: '_id title difficulty tags'
    });
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.status(200).send(user);
  } catch (error) {
    res.status(500).send("Error: " + error);
  }
}

/**
 * Fetches user submissions history for a specific coding problem.
 * 
 * @param {Object} req - Express request containing the target problem ID in params.pid
 * @param {Object} res - Express response
 */
const submittedProblem = async (req, res) => {
  try {
    const userId = req.user._id;
    const problemId = req.params.pid;

    const ans = await Submission.find({ userId, problemId });
  
    if (ans.length == 0) {
      return res.status(200).send("No Submission is present");
    }

    res.status(200).send(ans);
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
}

/**
 * Gathers a list of problems that the user has attempted but not yet solved.
 * 
 * Analyzes submission logs, builds a distinct list of attempted problems,
 * and filters out any challenges present in the user's solved list.
 * 
 * @param {Object} req - Express request containing user metadata
 * @param {Object} res - Express response
 */
const getAttemptedProblems = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Retrieve all historical code submissions by user
    const submissions = await Submission.find({ userId }).populate({
      path: 'problemId',
      select: '_id title difficulty tags'
    });
    
    // Build a lookup set of all solved problem IDs
    const user = await User.findById(userId);
    const solvedIds = new Set(user.problemSolved.map(id => id.toString()));
    
    // Filter distinct attempted problems that are not yet solved
    const wronglySubmitted = new Map();
    submissions.forEach(sub => {
      if (sub.problemId && !solvedIds.has(sub.problemId._id.toString())) {
        wronglySubmitted.set(sub.problemId._id.toString(), sub.problemId);
      }
    });

    res.status(200).send(Array.from(wronglySubmitted.values()));
  } catch (err) {
    res.status(500).send("Error: " + err);
  }
}

module.exports = {
  createProblem, updateProblem, deleteProblem, getProblemById, 
  getAllProblem, solvedAllProblemByUser, submittedProblem, getAttemptedProblems
};


