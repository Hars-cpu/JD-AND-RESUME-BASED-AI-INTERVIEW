/**
 * @file AdminVideo.jsx
 * @summary Admin registry component showing the inventory of coding challenges. Allows admins to manage associated 
 *          video editorials by navigating to the upload editor or purging linked walkthrough videos from the database.
 * 
 * @functions
 * - AdminVideo: Main functional component that retrieves problems inventory on mount and routes video editing and deletion actions.
 * - fetchProblems: Issues a GET request to `/problem/getAllProblem` to retrieve the challenges inventory database.
 * - handleDelete: Triggers a deletion confirmation request, dispatches a DELETE call to `/video/delete/:id`, 
 *                  and triggers a reload of the problems table layout.
 */

import { useEffect, useState } from 'react';
import React from 'react';
import axiosClient from '../utils/axiosClient';
import { NavLink } from 'react-router';
import AppShell from './layout/AppShell';
import { ArrowLeft, Video, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from './interview/FeedbackUI';

const AdminVideo = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axiosClient.get('/problem/getAllProblem');
      const list = Array.isArray(data) ? data : (Array.isArray(data?.problems) ? data.problems : []);
      setProblems(list);
    } catch (err) {
      if (err.response?.status === 404) {
        setProblems([]);
        setError(null);
      } else {
        setError('Failed to fetch problems');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this video solution?')) return;
    
    try {
      await axiosClient.delete(`/video/delete/${id}`);
      alert('Video solution deleted successfully!');
      fetchProblems();
    } catch (err) {
      setError(err?.message || 'Failed to delete video solution');
      console.log(err);
    }
  };

  if (loading) {
    return <LoadingSkeleton title="Loading sandbox problems" rows={3} />;
  }

  return (
    <AppShell
      title="Video Editorials Registry"
      subtitle="Publish or purge high-quality video editorials mapping step-by-step logic to algorithm tasks."
      actions={
        <NavLink to="/admin" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5 no-underline">
          <ArrowLeft size={13} />
          <span>Admin Workbench</span>
        </NavLink>
      }
    >
      <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-up">
        {error && <ErrorState title="System Exception" message={typeof error === 'string' ? error : error?.message || 'Error occurred'} onRetry={fetchProblems} />}

        {!error && (
          <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
            <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40">
              <h2 className="text-sm font-black text-white font-heading tracking-tight">Problems & Video Solutions</h2>
              <p className="text-xs text-slate-400 mt-1">Review active sandbox challenges and manage their walkthrough publications.</p>
            </div>

            <div className="overflow-x-auto bg-slate-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 bg-slate-900/30">
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/12">#</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-5/12">Title</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-2/12">Difficulty</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-2/12">Tag</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-2/12">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {!Array.isArray(problems) || problems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-16 text-center text-xs text-slate-500 italic">
                        <EmptyState
                          title="No problems found"
                          description="The active database has no problems registered to hold solutions."
                          icon={Video}
                        />
                      </td>
                    </tr>
                  ) : (
                    problems.map((problem, index) => {
                      const diffText = typeof problem.difficulty === 'string' ? problem.difficulty : (problem.difficulty?.name || 'Medium');
                      const tagsList = Array.isArray(problem.tags) ? problem.tags : [problem.tags].filter(Boolean);

                      return (
                        <tr key={problem._id || index} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                          <td className="px-5 py-4 text-xs font-bold text-white">{problem.title || "Untitled"}</td>
                          <td className="px-5 py-4">
                            <span className={`premium-badge-${
                              diffText === 'Easy' || diffText === 'easy'
                                ? 'green' 
                                : diffText === 'Medium' || diffText === 'medium'
                                  ? 'amber' 
                                  : 'red'
                            } text-[10px] py-0.5 px-2.5 font-bold uppercase`}>
                              {diffText}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {tagsList.map((tag, idx) => {
                                const tagLabel = typeof tag === 'object' ? (tag?.name || tag?.label || JSON.stringify(tag)) : String(tag);
                                return (
                                  <span key={idx} className="premium-badge-blue text-[10px] py-0.5 px-2.5 font-bold uppercase">
                                    {tagLabel}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <NavLink 
                                to={`/admin/upload/${problem._id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 shadow-md"
                              >
                                <Video size={13} />
                                <span>Upload</span>
                              </NavLink>
                              <button 
                                onClick={() => handleDelete(problem._id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-400 hover:bg-red-500/20 shadow-md"
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                        </td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
};

export default AdminVideo;