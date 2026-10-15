/**
 * @file SubmissionHistory.jsx
 * @summary Displays a table showing the user's code submission history (language, status, runtime, memory, test cases) 
 *          for a given problem. Includes a modal detailing the code submitted and any runtime error messages.
 * 
 * @functions
 * - SubmissionHistory: Primary functional component that fetches submission history on `problemId` change and displays records.
 * - getStatusBadge: Maps execution statuses (Accepted, Wrong Answer, Pending, Error) to color-coded badges.
 * - formatMemory: Converts raw memory stats (in KB) to MB if large enough.
 * - formatDate: Formats submission ISO timestamps to localized strings.
 */

import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Clock, Code2 } from "lucide-react";
import axiosClient from "../utils/axiosClient";

const SubmissionHistory = ({ problemId }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // ================= FETCH =================
  // Interview Note: Race Conditions in API Fetch.
  // Interviewer Question: "What is a potential race condition in this useEffect on page changes, and how do you fix it?"
  // Answer: If the user changes problemId rapidly, fetches run concurrently and may resolve out of order.
  // Fix: Use an AbortController or a boolean cleanup flag (e.g., `let active = true; ... return () => { active = false; }`)
  // to ensure only the latest request updates the local state.
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get(`/problem/submittedProblem/${problemId}`);
        setSubmissions(Array.isArray(response.data) ? response.data : []);
        setError(null);
      } catch (err) {
        setError("Failed to fetch submission history");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (problemId) fetchSubmissions();
  }, [problemId]);

  // ================= HELPERS =================
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <CheckCircle2 size={13} />
            Accepted
          </span>
        );
      case "wrong":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs font-bold text-rose-300">
            <XCircle size={13} />
            Wrong Answer
          </span>
        );
      case "error":
      case "runtime error":
      case "compilation error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-300">
            <AlertCircle size={13} />
            Error
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-bold text-blue-300">
            <Clock size={13} className="animate-spin" />
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-400">
            {status || "Unknown"}
          </span>
        );
    }
  };

  const formatMemory = (memory = 0) => {
    if (!memory) return "-";
    if (memory < 1024) return `${memory} KB`;
    return `${(memory / 1024).toFixed(2)} MB`;
  };

  // Interview Note: Date Localization & SSR.
  // Interviewer Question: "What is the problem with using `toLocaleString` directly in Server-Side Rendering (SSR)?"
  // Answer: It can cause hydration mismatch warnings because the server and client may have different system time zones.
  // For standard client-only SPA React projects, this is fine, but in SSR frameworks (like Next.js) we must defer 
  // formatting until after the component mounts on the client.
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  // ================= LOADING =================
  // Interview Note: Guard Clauses & Clean UI Rendering.
  // Interviewer Question: "What are the advantages of using early returns for loading and error states?"
  // Answer: (1) Keeps the main render code flat and readable. (2) Prevents runtime errors from attempting
  // to reference properties on undefined variables before they've loaded.
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <span className="loading loading-spinner loading-md text-emerald-400"></span>
        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Fetching Submissions...</span>
      </div>
    );
  }

  // ================= ERROR =================
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-300 flex items-center gap-2 my-4">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  // ================= UI =================
  return (
    <div className="w-full">
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/8 bg-white/[0.01] p-10 text-center">
          <Code2 className="text-slate-600 mb-3" size={32} />
          <h4 className="text-sm font-black text-white">No submissions found</h4>
          <p className="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
            Submit your solution in the Monaco editor code panel to record a submission.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto premium-scrollbar rounded-xl border border-white/5 bg-slate-950/40">
            <table className="w-full min-w-[700px] text-left border-collapse">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.15em] text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-bold">#</th>
                  <th className="px-4 py-3.5 font-bold">Language</th>
                  <th className="px-4 py-3.5 font-bold">Status</th>
                  <th className="px-4 py-3.5 font-bold">Runtime</th>
                  <th className="px-4 py-3.5 font-bold">Memory</th>
                  <th className="px-4 py-3.5 font-bold">Test Cases</th>
                  <th className="px-4 py-3.5 font-bold">Submitted</th>
                  <th className="px-4 py-3.5 font-bold text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                {submissions.map((sub, index) => (
                  <tr key={sub?._id || index} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3.5 font-bold text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-200">{sub?.language || "-"}</td>
                    <td className="px-4 py-3.5">{getStatusBadge(sub?.status)}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-300">{sub?.runtime ? `${sub.runtime}s` : "-"}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-300">{formatMemory(sub?.memory)}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-300">
                      {sub?.testCasesPassed ?? 0} / {sub?.testCasesTotal ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{formatDate(sub?.createdAt)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        className="premium-muted-button px-2.5 py-1.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        View Code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3.5 text-xs font-semibold text-slate-500">
            Showing {submissions.length} submission history records
          </p>
        </>
      )}

      {/* ================= DETAILS MODAL ================= */}
      {/* 
        Interview Note: Modals and DOM Hierarchy.
        Interviewer Question: "What issues arise from placing modals inline like this, and what is the best practice?"
        Answer: Placing it inline can cause CSS layout issues (like z-index nesting limits or parent `overflow: hidden` cutting it off).
        Best Practice: Use React Portals (`ReactDOM.createPortal`) to mount the modal directly at the document body root 
        while preserving React event bubbling.
      */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <h3 className="text-lg font-black font-heading border-b border-white/5 pb-4.5 flex items-center gap-2">
              <Code2 className="text-emerald-400" size={20} />
              <span>Submission Code Details</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-400 ml-auto uppercase">
                {selectedSubmission?.language || "-"}
              </span>
            </h3>

            <div className="flex flex-wrap gap-2.5 my-5 shrink-0">
              {getStatusBadge(selectedSubmission?.status)}
              
              <span className="inline-flex rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                Runtime: {selectedSubmission?.runtime || "-"}s
              </span>

              <span className="inline-flex rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                Memory: {formatMemory(selectedSubmission?.memory)}
              </span>

              <span className="inline-flex rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                Passed: {selectedSubmission?.testCasesPassed ?? 0} / {selectedSubmission?.testCasesTotal ?? 0}
              </span>
            </div>

            {selectedSubmission?.errorMessage && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300 mb-4 shrink-0 overflow-x-auto max-h-24">
                {selectedSubmission.errorMessage}
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-slate-950 p-4.5 font-mono text-xs text-slate-300 premium-scrollbar leading-relaxed">
              <pre className="whitespace-pre-wrap">
                <code>{selectedSubmission?.code || "No code available"}</code>
              </pre>
            </div>

            <div className="mt-5 flex justify-end gap-3 shrink-0">
              <button
                className="ghost-button px-5 py-2 text-xs font-bold cursor-pointer"
                onClick={() => setSelectedSubmission(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionHistory;
