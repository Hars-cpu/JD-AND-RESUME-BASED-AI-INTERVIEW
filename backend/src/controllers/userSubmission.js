/**
 * @file userSubmission.js
 * @summary Backend controller handling code compiling, visible sample runs, and final test case submissions.
 *          Interfaces with the Judge0 compiler engine to run user code batches, polls execution outputs,
 *          analyzes correct/incorrect matches, saves logs to the database, and updates the user's solved challenges list.
 * 
 * @functions
 * - delay: Promise-based utility function to delay thread executions.
 * - submitCode: Submits code against hidden test cases. Writes standard logs to the database,
 *               polls Judge0 batch responses, scores pass ratios, and appends solved problems to user records.
 * - runCode: Evaluates code against visible test cases for quick playground execution without database persistence.
 * - cleanInput: Utility helper to sanitize input parameters by removing surrounding double quotes for C++ and Java.
 */

const Problem = require("../models/problem");
const Submission = require("../models/submission");
const User = require("../models/user");
const {getLanguageById,submitBatch,submitToken} = require("../utils/problemUtility");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const submitCode = async (req, res) => {
  let submittedResult = null;
  try {
    const userId = req.user?._id;
    const problemId = req.params?.id;
    let { code, language } = req.body;

    if (!userId || !code || !problemId || !language)
      return res.status(400).send("Some field missing");

    // ✅ Fetch the problem from database
    const problem = await Problem.findById(problemId);

    if (!problem) return res.status(404).send("Problem not found");

    if (!problem.hiddenTestCases || problem.hiddenTestCases.length === 0) {
      return res.status(400).send("No hidden testcases found");
    }

    const allTestCases = [...(problem.visibleTestCases || []), ...(problem.hiddenTestCases || [])];

    // ✅ Store submission first
    submittedResult = await Submission.create({
      userId,
      problemId,
      code,
      language,
      testCasesPassed: 0,
      status: "pending",
      testCasesTotal: allTestCases.length,
    });

    // ✅ Judge0 code submit
    const languageId = getLanguageById(language);

    if (!languageId) {
      submittedResult.status = "error";
      submittedResult.errorMessage = "Invalid language";
      await submittedResult.save();
      return res.status(400).send("Invalid language");
    }

    const cleanInput = (val) => {
      if (language === 'cpp' || language === 'java') {
        if (val && val.startsWith('"') && val.endsWith('"')) {
          return val.slice(1, -1);
        }
      }
      return val;
    };

    const submissions = allTestCases.map((testcase) => ({
      source_code: code,
      language_id: languageId,
      stdin: cleanInput(testcase.input),
      expected_output: testcase.output,
    }));

    const submitResult = await submitBatch(submissions);
    if (!submitResult || !Array.isArray(submitResult)) {
      throw new Error("Failed to submit batch to Judge0");
    }

    const resultToken = submitResult.map((value) => value.token);

    const testResult = await submitToken(resultToken);
    if (!testResult || !Array.isArray(testResult)) {
      throw new Error("Failed to poll execution results from Judge0");
    }

    // ✅ Update submittedResult
    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = "accepted";
    let errorMessage = null;

    for (const test of testResult) {
      if (!test) {
        status = "error";
        errorMessage = "Empty test case response from Judge0";
        break;
      }
      if (test.status_id == 3) {
        testCasesPassed++;
        runtime += test.time ? parseFloat(test.time) : 0;
        memory += test.memory ? parseInt(test.memory) : 0;
      } else {
        // ❌ handle failures properly
        if (test.status_id == 4) {
          status = "wrong";
          errorMessage = test.stderr || test.message || "Wrong Answer";
        } else if (test.status_id == 6) {
          status = "error";
          errorMessage = test.compile_output || "Compile Error";
        } else if (test.status_id == 5) {
          status = "error";
          errorMessage = test.message || "TLE";
        } else {
          status = "error";
          errorMessage = test.stderr || test.message || "Execution Error";
        }
        break;
      }
    }

    // ✅ Save submission result
    submittedResult.status = status;
    submittedResult.errorMessage = errorMessage;
    submittedResult.memory = memory;
    submittedResult.testCasesPassed = testCasesPassed;
    submittedResult.runtime = runtime;
    await submittedResult.save();

    // ✅ Insert into solved only if accepted
    if (status === "accepted") {
      try {
        const user = await User.findByIdAndUpdate(
          userId,
          { $addToSet: { problemSolved: problemId } },
          { new: true } // Return the updated document
        );
        if (user) {
          console.log(`✅ Problem ${problemId} added to user ${userId} solved list.`);
        } else {
          console.warn(`⚠️ User ${userId} not found when trying to update problemSolved list.`);
        }
      } catch (saveError) {
        console.error("❌ Failed to update problemSolved list:", saveError);
      }
    }

    const accepted = status === "accepted";

    return res.status(201).json({
      accepted,
      totalTestCases: submittedResult.testCasesTotal,
      passedTestCases: testCasesPassed,
      runtime,
      memory,
      status,
      errorMessage,
    });
  } catch (error) {
    console.error("❌ Error in submitCode controller:", error.message || error);
    if (submittedResult) {
      try {
        submittedResult.status = "error";
        submittedResult.errorMessage = error.message || String(error);
        await submittedResult.save();
      } catch (dbErr) {
        console.error("❌ Failed to update error status on database submission:", dbErr);
      }
    }
    return res.status(400).send("Error: " + (error.message || error));
  }
};

const runCode = async(req,res)=>{
  try{
    const userId = req.user?._id;
    const problemId = req.params?.id;
    let {code,language} = req.body;

    if(!userId||!code||!problemId||!language)
      return res.status(400).send("Some field missing");

    // Fetch the problem from database
    const problem = await Problem.findById(problemId);
    if (!problem) return res.status(404).send("Problem not found");

    if (!problem.visibleTestCases || problem.visibleTestCases.length === 0) {
      return res.status(400).send("No visible testcases found for this problem");
    }

    const languageId = getLanguageById(language);
    if (!languageId) {
      return res.status(400).send("Invalid language");
    }

    const cleanInput = (val) => {
      if (language === 'cpp' || language === 'java') {
        if (val && val.startsWith('"') && val.endsWith('"')) {
          return val.slice(1, -1);
        }
      }
      return val;
    };

    const submissions = problem.visibleTestCases.map((testcase)=>({
        source_code:code,
        language_id: languageId,
        stdin: cleanInput(testcase.input),
        expected_output: testcase.output
    }));

    const submitResult = await submitBatch(submissions);
    if (!submitResult || !Array.isArray(submitResult)) {
      return res.status(502).send("Failed to submit code to Judge0");
    }

    const resultToken = submitResult.map((value)=> value.token);

    const testResult = await submitToken(resultToken);
    if (!testResult || !Array.isArray(testResult)) {
      return res.status(502).send("Failed to retrieve run results from Judge0");
    }

    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = true;

    for(const test of testResult){
        if (!test) continue;
        if(test.status_id==3){
           testCasesPassed++;
           runtime = runtime + (test.time ? parseFloat(test.time) : 0);
           memory = Math.max(memory, test.memory ? parseInt(test.memory) : 0);
        }else{
           status = false;
        }
    }

    res.status(201).json({
      success:status,
      testCases: testResult,
      runtime,
      memory
    });
  }
  catch(err){
    console.error("❌ Error in runCode controller:", err.message || err);
    res.status(500).send("Internal Server Error " + (err.message || err));
  }
}
module.exports={submitCode,runCode};