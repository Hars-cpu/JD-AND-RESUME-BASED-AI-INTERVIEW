/**
 * @file InterviewAnalyticsDashboard.jsx
 * @description Mock Interview performance evaluation analytics dashboard for ALGOPILOT.
 * Displays stats overview cards, custom SVG analytics trend graphs, strengths/weaknesses logs,
 * focus areas, and downloadable scorecard audit reports.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  X
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import AppShell from "../../components/layout/AppShell";
import { EmptyState, ErrorState, LoadingSkeleton, Toast } from "../../components/interview/FeedbackUI";

// Fallback analytics state definitions
const emptyAnalytics = {
  totalInterviews: 0,
  averageOverallScore: 0,
  averageTechnicalScore: 0,
  averageCommunicationScore: 0,
  averageProblemSolvingScore: 0,
  averageProjectDiscussionScore: 0,
  hireRecommendationBreakdown: {
    "Strong Hire": 0,
    Hire: 0,
    Borderline: 0,
    "No Hire": 0
  },
  scoreTrend: [],
  topStrengths: [],
  topWeaknesses: [],
  recommendedFocusAreas: [],
  reportHistory: []
};

/**
 * Formats a timestamp into a standard readable date string (e.g. Oct 9, 2026).
 * @param {string|Date} date - Timestamp input
 * @returns {string} Formatted string
 */
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

/**
 * Formats current date for file exports (e.g. 2026_10_09).
 * @param {Date} date - Date object
 * @returns {string} Formatted string
 */
const formatFileDate = (date = new Date()) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
};

/**
 * Triggers a browser-based download of binary file objects (Blobs).
 * @param {Blob} blob - Binary data object
 * @param {string} filename - Targeted file name output
 */
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * OverviewCard Component
 * Displays statistical values inside analytical overview cards.
 */
function OverviewCard({ label, value, caption, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "from-emerald-950/30 to-emerald-900/5 text-emerald-300 border-emerald-500/20 border-l-4 border-l-emerald-400",
    blue: "from-blue-950/30 to-blue-900/5 text-blue-300 border-blue-500/20 border-l-4 border-l-blue-400",
    amber: "from-amber-950/30 to-amber-900/5 text-amber-300 border-amber-500/20 border-l-4 border-l-amber-400",
    violet: "from-violet-950/30 to-violet-900/5 text-violet-300 border-violet-500/20 border-l-4 border-l-violet-400"
  };

  return (
    <div className={`premium-card bg-gradient-to-br p-5 flex flex-col justify-between relative overflow-hidden ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-3xl font-black text-white mt-3 font-heading tracking-tight">{value}</p>
          {caption && <p className="text-xs text-slate-400 mt-2 font-semibold">{caption}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-slate-300 flex items-center justify-center shadow-inner shrink-0">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

/**
 * LineChart Component
 * Renders a lightweight, high-performance responsive custom SVG line chart.
 * Automatically computes coordinate points and draws grid-lines for score histories.
 */
function LineChart({ title, data, fields }) {
  // Dimensions and margins for the coordinate bounding box
  const width = 720;
  const height = 240;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculates a string of "X,Y" points coordinates to supply to <polyline>
  const pointsFor = (field) => {
    if (data.length === 0) return "";

    return data.map((item, index) => {
      // Linearly space data points along X-axis
      const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * chartWidth;
      // Invert Y axis scale (0% is at the bottom, 100% is at the top of the chart box)
      const y = padding + (1 - (Number(item[field]) || 0) / 100) * chartHeight;
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
        <h2 className="text-sm font-black text-white font-heading tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-1">Score progress tracking across mock rounds</p>
      </div>

      <div className="p-5 bg-slate-950/20 overflow-x-auto flex-1">
        {data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-slate-500 italic">
            No interview score history generated yet.
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full h-[260px]">
            {[0, 25, 50, 75, 100].map((score) => {
              const y = padding + (1 - score / 100) * chartHeight;
              return (
                <g key={score}>
                  <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255, 255, 255, 0.05)" />
                  <text x={4} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.25)" className="font-mono font-bold">{score}</text>
                </g>
              );
            })}

            {fields.map((field) => (
              <polyline
                key={field.key}
                points={pointsFor(field.key)}
                fill="none"
                stroke={field.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_2px_8px_rgba(52,211,153,0.15)]"
              />
            ))}

            {data.map((item, index) => {
              const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * chartWidth;
              return (
                <text key={item.reportId || index} x={x - 22} y={height - 6} fontSize="9" fill="rgba(255,255,255,0.4)" className="font-semibold">
                  {formatDate(item.date).split(",")[0]}
                </text>
              );
            })}
          </svg>
        )}

        <div className="flex flex-wrap gap-4 mt-4 border-t border-white/5 pt-3.5 select-none">
          {fields.map((field) => (
            <span key={field.key} className="inline-flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: field.color }} />
              {field.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankedList({ title, items, emptyText }) {
  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
        <h2 className="text-sm font-black text-white font-heading tracking-tight">{title}</h2>
      </div>
      <div className="p-5 space-y-2 bg-slate-950/20 flex-1">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-1">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3.5 py-2.5 shadow-inner">
              <span className="text-xs font-semibold text-slate-300 leading-relaxed">{item.label}</span>
              <span className="premium-badge-green text-[10px] py-0.5 px-2 font-black shrink-0 mt-0.5" title="Frequency across all interviews">{item.count}x</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ReportPanel({ report, onClose, onExportReport, exportingReportId }) {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 relative">
        <div className="absolute inset-0 grid-pattern-overlay opacity-10 pointer-events-none" />
        
        <div className="px-6 py-5 border-b border-white/8 bg-slate-950/40 flex items-center justify-between gap-4 sticky top-0 backdrop-blur-xl z-10">
          <div>
            <h2 className="text-lg font-black text-white font-heading leading-tight">AI Interview Report</h2>
            <p className="text-xs text-slate-400 mt-1">{formatDate(report.createdAt)} &middot; {report.hireRecommendation}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportReport(report)}
              disabled={exportingReportId === report.sessionId}
              className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={13} />
              {exportingReportId === report.sessionId ? "Exporting..." : "PDF"}
            </button>
            <button onClick={onClose} className="ghost-button text-xs py-2 px-3 shadow-md flex items-center justify-center shrink-0 text-slate-400 hover:text-white border-white/10">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 relative z-10 bg-slate-950/20">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Overall", report.overallScore],
              ["Technical", report.technicalScore],
              ["Communication", report.communicationScore],
              ["Problem Solve", report.problemSolvingScore],
              ["Projects", report.projectDiscussionScore]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/5 bg-slate-950/50 p-3 shadow-inner">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className="text-xl font-black text-emerald-400 mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4 text-xs leading-relaxed text-slate-200">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-400" />
              Summary Assessment
            </p>
            <p>{report.summary}</p>
          </div>

          {[
            ["Strengths", report.strengths, ShieldCheck, "border-emerald-500/10 bg-emerald-500/5 text-emerald-300"],
            ["Weaknesses & Gaps", report.weaknesses, AlertTriangle, "border-red-500/10 bg-red-500/5 text-red-300"],
            ["AI Focus Recommendations", report.recommendations, Flame, "border-blue-500/10 bg-blue-500/5 text-blue-300"]
          ].map(([title, items, Icon, cardStyle]) => (
            <div key={title}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1">
                <Icon size={12} className={title.includes("Strength") ? "text-emerald-400" : title.includes("Weak") ? "text-red-400" : "text-blue-400"} />
                <span>{title}</span>
              </h3>
              <ul className="space-y-2">
                {(items || []).map((item) => (
                  <li key={item} className={`rounded-xl border p-3 text-xs leading-relaxed shadow-inner flex items-start gap-2.5 ${cardStyle}`}>
                    <ChevronRight size={13} className="shrink-0 mt-0.5 opacity-40" />
                    <span>{item}</span>
                  </li>
                ))}
                {(items || []).length === 0 && (
                  <li className="text-xs text-slate-600 italic px-2">No focus items recorded.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterviewAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [exportingReportId, setExportingReportId] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const { data } = await axiosClient.get("/api/interview/analytics");
        setAnalytics({ ...emptyAnalytics, ...data });
      } catch (loadError) {
        setError(loadError.response?.data?.error || "Failed to load interview analytics");
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const bestScore = useMemo(() => {
    if (!analytics.reportHistory.length) return 0;
    return Math.max(...analytics.reportHistory.map((report) => report.overallScore || 0));
  }, [analytics.reportHistory]);

  const latestScore = analytics.reportHistory[0]?.overallScore || 0;

  const handleExportReport = async (report) => {
    if (!report?.sessionId) return;

    try {
      setExportingReportId(report.sessionId);
      const response = await axiosClient.get(`/api/interview/report/${report.sessionId}/pdf`, {
        responseType: "blob"
      });
      downloadBlob(response.data, `Interview_Report_${formatFileDate(report.createdAt)}.pdf`);
      setToast({
        title: "PDF downloaded",
        message: "Your interview report was exported successfully."
      });
    } catch (exportError) {
      setError(exportError.response?.data?.error || "Failed to export interview report PDF");
    } finally {
      setExportingReportId("");
    }
  };

  if (loading) {
    return <LoadingSkeleton title="Loading interview analytics" rows={3} />;
  }

  return (
    <AppShell
      title="Performance Analytics"
      subtitle="Analyze mock scorecards progress, strengths counts, weaknesses, and performance curves over time."
      actions={
        <NavLink to="/dashboard" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5">
          <ArrowLeft size={13} />
          <span>Dashboard</span>
        </NavLink>
      }
    >
      <div className="space-y-6">
        {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

        {/* Top metrics summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <OverviewCard label="Total Interviews" value={analytics.totalInterviews} caption="Completed assessment reports" icon={CalendarDays} tone="emerald" />
          <OverviewCard label="Average Rating" value={`${analytics.averageOverallScore}%`} caption="Average overall mock score" icon={BarChart3} tone="blue" />
          <OverviewCard label="Personal Best" value={`${bestScore}%`} caption="Highest overall scorecard" icon={TrendingUp} tone="violet" />
          <OverviewCard label="Latest Rating" value={`${latestScore}%`} caption="Most recent mock rating" icon={Target} tone="amber" />
        </div>

        {/* Custom trend chart */}
        <LineChart
          title="Performance Trends Curves"
          data={analytics.scoreTrend}
          fields={[
            { key: "overallScore", label: "Overall Quotient", color: "#34d399" },
            { key: "technicalScore", label: "Technical DSA Core", color: "#60a5fa" },
            { key: "communicationScore", label: "Speech Communication", color: "#fbbf24" }
          ]}
        />

        {/* Ranked Strengths/Weaknesses/Recs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <RankedList title="Strength Matrix Areas" items={analytics.topStrengths} emptyText="No strengths calculated yet." />
          <RankedList title="Weakness Correction Areas" items={analytics.topWeaknesses} emptyText="No weaknesses calculated yet." />
          <RankedList title="AI Focus Gaps" items={analytics.recommendedFocusAreas} emptyText="No focus recommendations generated yet." />
        </div>

        {/* History table list */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
            <h2 className="text-sm font-black text-white font-heading tracking-tight">Interview Assessment History</h2>
            <p className="text-xs text-slate-400 mt-1">Access compiled score reports to review feedback logs</p>
          </div>

          <div className="overflow-x-auto bg-slate-950/20 flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 bg-slate-900/30">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Session Date</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Overall Score</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Recommendation</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Report Utility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.reportHistory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-16 text-center text-xs text-slate-500 italic">
                      <EmptyState
                        title="No analytics generated yet"
                        description="Complete mock interviews and scorecard generations to construct analytics history."
                        icon={BarChart3}
                      />
                    </td>
                  </tr>
                ) : (
                  analytics.reportHistory.map((report) => (
                    <tr key={report.reportId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 text-xs font-bold text-slate-200">{formatDate(report.createdAt)}</td>
                      <td className="px-5 py-4 text-sm font-black text-white">{report.overallScore}%</td>
                      <td className="px-5 py-4">
                        <span className="premium-badge-green text-[10px] py-0.5 px-2.5 font-extrabold uppercase select-none">
                          {report.hireRecommendation}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleExportReport(report)}
                            disabled={exportingReportId === report.sessionId}
                            className="ghost-button text-xs py-1.5 px-3 shadow-md flex items-center gap-1 text-slate-400 hover:text-white border-white/10"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="premium-button text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <FileText size={13} />
                            <span>View Report</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ReportPanel
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onExportReport={handleExportReport}
        exportingReportId={exportingReportId}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

export default InterviewAnalyticsDashboard;
