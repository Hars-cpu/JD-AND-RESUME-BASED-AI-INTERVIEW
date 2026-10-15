/**
 * @file HomePage.jsx
 * @summary React view page displaying the dashboard workspace cockpit for Home page.
 *          It fetches the overall list of problems, the problems solved by the current user,
 *          and provides admin functions to delete problems if the user has admin privileges.
 * @functions
 * - HomePage: Main component rendering the home dashboard.
 * - fetchProblems: Retrieves all available coding problems from the backend API.
 * - fetchSolvedProblems: Retrieves the list of problems successfully solved by the authenticated user.
 * - handleDelete: Admin-only function to delete a specific problem from the database.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { useSelector } from "react-redux";
import { CheckCircle2, Filter, Search, SlidersHorizontal, Target, XCircle } from "lucide-react";
import axiosClient from "../utils/axiosClient";
import AppShell from "../components/layout/AppShell";

const DIFF_COLORS = {
  easy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  hard: "border-rose-400/30 bg-rose-400/10 text-rose-200"
};

export const TAG_LABELS = {
  array: "Array",
  string: "String",
  hashTable: "Hash Table",
  linkedList: "Linked List",
  tree: "Tree / Binary Tree",
  binarySearch: "Binary Search",
  twoPointers: "Two Pointers",
  sorting: "Sorting",
  stack: "Stack",
  queue: "Queue",
  heap: "Heap (Priority Queue)",
  greedy: "Greedy",
  recursion: "Recursion",
  backtracking: "Backtracking",
  bitManipulation: "Bit Manipulation",
  bfs: "Breadth-First Search (BFS)",
  dfs: "Depth-First Search (DFS)",
  graph: "Graph",
  dp: "Dynamic Programming (DP)",
  slidingWindow: "Sliding Window",
  math: "Math",
  matrix: "Matrix"
};

function HomePage() {
  const { user } = useSelector((state) => state.auth);
  const [problems, setProblems] = useState([]);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const { data } = await axiosClient.get("/problem/getAllProblem");
        setProblems(data || []);
      } catch (error) {
        console.error("Error fetching problems:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchSolvedProblems = async () => {
      try {
        const { data } = await axiosClient.get("/problem/problemSolvedByUser");
        setSolvedProblems(data.problemSolved || []);
      } catch (error) {
        console.error("Error fetching solved problems:", error);
      }
    };

    fetchProblems();
    if (user) fetchSolvedProblems();
  }, [user]);

  const solvedIds = useMemo(() => new Set(solvedProblems.map((problem) => problem._id)), [solvedProblems]);
  const allTags = useMemo(() => (
    Array.from(new Set(problems.flatMap((problem) => Array.isArray(problem.tags) ? problem.tags : [problem.tags]).filter(Boolean)))
  ), [problems]);

  const filteredProblems = useMemo(() => (
    problems.filter((problem) => {
      const matchesSearch = problem.title?.toLowerCase().includes(search.toLowerCase());
      const matchesDiff = difficulty === "All" || problem.difficulty?.toLowerCase() === difficulty.toLowerCase();
      const tags = Array.isArray(problem.tags) ? problem.tags : [problem.tags];
      const matchesTag = tagFilter === "All" || tags.some((tag) => tag?.toLowerCase() === tagFilter.toLowerCase());
      return matchesSearch && matchesDiff && matchesTag;
    })
  ), [problems, search, difficulty, tagFilter]);

  const stats = useMemo(() => {
    const easy = problems.filter((problem) => problem.difficulty?.toLowerCase() === "easy").length;
    const medium = problems.filter((problem) => problem.difficulty?.toLowerCase() === "medium").length;
    const hard = problems.filter((problem) => problem.difficulty?.toLowerCase() === "hard").length;
    return { easy, medium, hard, solved: solvedProblems.length, total: problems.length };
  }, [problems, solvedProblems]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this problem?")) return;
    try {
      await axiosClient.delete(`/problem/delete/${id}`);
      setProblems((prev) => prev.filter((problem) => problem._id !== id));
    } catch (error) {
      alert("Error deleting problem");
    }
  };

  return (
    <AppShell
      title="Problems"
      subtitle="A powerful algorithmic practice table with solved indicators, sharp filters, difficulty badges, tags, and quick actions."
      actions={<NavLink to="/interview/start" className="premium-button px-4 py-2 text-sm">AI Interview Copilot</NavLink>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total Problems", stats.total],
          ["Solved", stats.solved],
          ["Easy", stats.easy],
          ["Medium / Hard", `${stats.medium} / ${stats.hard}`]
        ].map(([label, value]) => (
          <div key={label} className="premium-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <section className="premium-card mt-6 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by problem title..."
              className="premium-input h-12 w-full !pl-10 pr-4 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select className="premium-input h-12 px-3 text-sm" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="All">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select className="premium-input h-12 px-3 text-sm" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="All">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{TAG_LABELS[tag] || tag}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch("");
              setDifficulty("All");
              setTagFilter("All");
            }}
            className="premium-muted-button inline-flex h-12 items-center justify-center gap-2 px-4 text-sm"
          >
            <Filter size={16} />
            Clear
          </button>
        </div>
      </section>

      <section className="premium-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-white">Problem Set</h2>
            <p className="text-sm text-slate-400">{filteredProblems.length} visible problems</p>
          </div>
          <SlidersHorizontal className="text-slate-500" size={20} />
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <XCircle className="text-slate-600" size={42} />
            <h3 className="mt-4 text-lg font-black text-white">No problems found</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">Try a broader search or clear your filters to see more practice problems.</p>
          </div>
        ) : (
          <div className="overflow-x-auto premium-scrollbar">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Problem</th>
                  <th className="px-5 py-4">Difficulty</th>
                  <th className="px-5 py-4">Tags</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredProblems.map((problem) => {
                  const solved = solvedIds.has(problem._id);
                  const tags = Array.isArray(problem.tags) ? problem.tags : [problem.tags].filter(Boolean);
                  return (
                    <tr key={problem._id} className="group transition-colors hover:bg-white/[0.04]">
                      <td className="px-5 py-4">
                        {solved ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                            <CheckCircle2 size={14} />
                            Solved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <NavLink to={`/problems/${problem._id}`} className="font-black text-white transition-colors hover:text-emerald-200">
                          {problem.title}
                        </NavLink>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${DIFF_COLORS[problem.difficulty?.toLowerCase()] || DIFF_COLORS.medium}`}>
                          {problem.difficulty || "Medium"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-xs flex-wrap gap-2">
                          {tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-200">
                              {TAG_LABELS[tag] || tag}
                            </span>
                          ))}
                          {tags.length > 3 && <span className="text-xs font-bold text-slate-500">+{tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <NavLink to={`/problems/${problem._id}`} className="premium-button px-3 py-2 text-xs">
                            Solve
                          </NavLink>
                          {user?.role === "admin" && (
                            <>
                              <NavLink to={`/admin/upload/${problem._id}`} className="premium-muted-button px-3 py-2 text-xs">Video</NavLink>
                              <NavLink to={`/admin/problems/${problem._id}/edit`} className="premium-muted-button px-3 py-2 text-xs">Edit</NavLink>
                              <button onClick={() => handleDelete(problem._id)} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

export default HomePage;
