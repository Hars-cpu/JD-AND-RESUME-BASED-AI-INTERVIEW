/**
 * @file interviewAnalysisController.js
 * @summary Controller that runs a compatibility analysis between an uploaded resume and a job description.
 *          Passes the parsed resumeData and jdData to the analysis service which computes a match score,
 *          skill gap assessment, and topic recommendations to guide the user's mock interview configuration.
 *
 * @functions
 * - analyzeResumeAndJd: Accepts resumeData and jdData from the request body, calls analyzeResumeAgainstJd(),
 *                       and returns the match score and skill gap analysis to the frontend.
 */

const {
  InterviewAnalysisError,
  analyzeResumeAgainstJd
} = require('../../services/interview/interviewAnalysisService');

const analyzeResumeAndJd = async (req, res) => {
  try {
    console.log('[Analysis Controller] Received Resume vs JD analysis request');
    
    const resumeData = req.body?.resumeData;
    const jdData = req.body?.jdData;

    console.log('[Analysis Controller] Resume skills count:', resumeData?.skills?.length || 0);
    console.log('[Analysis Controller] JD technologies count:', jdData?.technologies?.length || 0);

    const analysis = await analyzeResumeAgainstJd({
      resumeData,
      jdData
    });

    console.log('[Analysis Controller] Analysis matching completed successfully. Match Score:', analysis.matchScore);
    res.status(200).json(analysis);
  } catch (error) {
    console.error('[Analysis Controller] Analysis failed:', error);
    
    if (error instanceof InterviewAnalysisError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to analyze resume against job description',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  analyzeResumeAndJd
};
