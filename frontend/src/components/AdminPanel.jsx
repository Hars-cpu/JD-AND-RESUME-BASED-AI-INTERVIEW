/**
 * @file AdminPanel.jsx
 * @summary Admin panel view to create and publish new competitive coding problems. It provides a multi-section form 
 *          for basic challenge metadata, difficulty, tags, dynamically managed arrays of visible and hidden test cases, 
 *          and starting boilerplates + reference solutions for multiple languages (C++, Java, and JavaScript).
 *          Validated client-side using React Hook Form and Zod schemas.
 * 
 * @functions
 * - AdminPanel: Primary functional component that sets up form state, validation schemas, default boilerplates, 
 *               dynamic arrays for test cases, and registers input handlers.
 * - onSubmit: Submits validated problem schemas to the backend API (`/problem/create`) and handles loading and navigation states.
 * - onInvalid: Triggered when validation fails; logs schemas errors to console and alerts the user to incomplete sections.
 */

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axiosClient from '../utils/axiosClient';
import { useNavigate, NavLink } from 'react-router';
import React, { useState } from 'react';
import AppShell from './layout/AppShell';
import { ArrowLeft, Plus, Trash, Trash2, Code2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

// Zod schema matching the problem schema
const problemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.enum(['array', 'string', 'hashTable', 'linkedList', 'tree', 'binarySearch', 'twoPointers', 'sorting', 'stack', 'queue', 'heap', 'greedy', 'recursion', 'backtracking', 'bitManipulation', 'bfs', 'dfs', 'graph', 'dp', 'slidingWindow', 'math', 'matrix']),
  visibleTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required'),
      explanation: z.string().min(1, 'Explanation is required')
    })
  ).min(1, 'At least one visible test case required'),
  hiddenTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required')
    })
  ).min(1, 'At least one hidden test case required'),
  startCode: z.array(
    z.object({
      language: z.enum(['cpp', 'java', 'javascript']),
      initialCode: z.string().min(1, 'Initial code is required')
    })
  ).length(3, 'All three languages required'),
  referenceSolution: z.array(
    z.object({
      language: z.enum(['cpp', 'java', 'javascript']),
      completeCode: z.string().min(1, 'Complete code is required')
    })
  ).length(3, 'All three languages required')
});

function AdminPanel() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      startCode: [
        { language: 'cpp', initialCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your logic here\n    return 0;\n}' },
        { language: 'java', initialCode: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write logic here\n    }\n}' },
        { language: 'javascript', initialCode: 'const fs = require("fs");\nlet input = fs.readFileSync("/dev/stdin").toString();\n// Write logic here\n' }
      ],
      referenceSolution: [
        { language: 'cpp', completeCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    if (cin >> a >> b) { cout << a + b; }\n    return 0;\n}' },
        { language: 'java', completeCode: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner s = new Scanner(System.in);\n        if (s.hasNextInt()) { int a = s.nextInt(); int b = s.nextInt(); System.out.print(a+b); }\n    }\n}' },
        { language: 'javascript', completeCode: 'const fs = require("fs");\nlet input = fs.readFileSync("/dev/stdin").toString().trim().split(/\\s+/);\nif (input.length >= 2) {\n  console.log(parseInt(input[0]) + parseInt(input[1]));\n}' }
      ],
      visibleTestCases: [{ input: '5 7', output: '12', explanation: '5+7 is 12' }],
      hiddenTestCases: [{ input: '10 10', output: '20' }]
    }
  });

  const {
    fields: visibleFields,
    append: appendVisible,
    remove: removeVisible
  } = useFieldArray({
    control,
    name: 'visibleTestCases'
  });

  const {
    fields: hiddenFields,
    append: appendHidden,
    remove: removeHidden
  } = useFieldArray({
    control,
    name: 'hiddenTestCases'
  });

  const onSubmit = async (data) => {
    try {
      setIsSaving(true);
      // Ensure language fields are explicitly set just in case react-hook-form omitted them
      data.startCode[0].language = 'cpp';
      data.startCode[1].language = 'java';
      data.startCode[2].language = 'javascript';
      data.referenceSolution[0].language = 'cpp';
      data.referenceSolution[1].language = 'java';
      data.referenceSolution[2].language = 'javascript';

      await axiosClient.post('/problem/create', data);
      alert('Problem created successfully!');
      navigate('/admin');
    } catch (error) {
      if (typeof error.response?.data === 'string') {
        alert(`Backend Error: ${error.response.data}`);
      } else {
        alert(`Error: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const onInvalid = (errors) => {
    console.log("Validation Errors:", errors);
    alert('Validation failed! Please ensure you have filled out all fields, including ALL templates and Test Cases.');
  };

  return (
    <AppShell
      title="Create Sandbox Challenge"
      subtitle="Publish algorithmic challenges to active candidate databases. Mapped examples and hidden evaluation suits will trigger compile runs."
      actions={
        <NavLink to="/admin" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5 no-underline">
          <ArrowLeft size={13} />
          <span>Admin Workbench</span>
        </NavLink>
      }
    >
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-up">
        
        {/* Basic Information */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white font-heading tracking-tight">1. Basic Information</h2>
          </div>
          
          <div className="p-5 space-y-4 bg-slate-950/20">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Title</label>
              <input
                {...register('title')}
                className={`w-full premium-input bg-[#0f172a] border ${errors.title ? 'border-red-500 focus:border-red-500' : 'border-white/10'} text-slate-200 outline-none rounded-xl text-xs py-2.5 px-3.5`}
                placeholder="e.g. Two Sum"
              />
              {errors.title && <span className="text-red-500 text-xs mt-1.5 block">{errors.title.message}</span>}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Description (Markdown Supported)</label>
              <textarea
                {...register('description')}
                rows={6}
                className={`w-full premium-input bg-[#0f172a] border ${errors.description ? 'border-red-500 focus:border-red-500' : 'border-white/10'} text-slate-200 outline-none rounded-xl text-xs py-2.5 px-3.5 resize-y`}
                placeholder="Describe the problem, constraints, and provide examples..."
              />
              {errors.description && <span className="text-red-500 text-xs mt-1.5 block">{errors.description.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Difficulty</label>
                <div className="relative">
                  <select
                    {...register('difficulty')}
                    className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-xl text-xs py-2.5 pl-3.5 pr-8 appearance-none cursor-pointer"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Primary Tag</label>
                <div className="relative">
                  <select
                    {...register('tags')}
                    className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-xl text-xs py-2.5 pl-3.5 pr-8 appearance-none cursor-pointer"
                  >
                    <option value="array">Array</option>
                    <option value="string">String</option>
                    <option value="hashTable">Hash Table</option>
                    <option value="linkedList">Linked List</option>
                    <option value="tree">Tree / Binary Tree</option>
                    <option value="binarySearch">Binary Search</option>
                    <option value="twoPointers">Two Pointers</option>
                    <option value="sorting">Sorting</option>
                    <option value="stack">Stack</option>
                    <option value="queue">Queue</option>
                    <option value="heap">Heap (Priority Queue)</option>
                    <option value="greedy">Greedy</option>
                    <option value="recursion">Recursion</option>
                    <option value="backtracking">Backtracking</option>
                    <option value="bitManipulation">Bit Manipulation</option>
                    <option value="bfs">Breadth-First Search (BFS)</option>
                    <option value="dfs">Depth-First Search (DFS)</option>
                    <option value="graph">Graph</option>
                    <option value="dp">Dynamic Programming (DP)</option>
                    <option value="slidingWindow">Sliding Window</option>
                    <option value="math">Math</option>
                    <option value="matrix">Matrix</option>
                  </select>
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Evaluation Criteria */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2">
            <HelpCircle size={16} className="text-emerald-400 animate-glow-pulse" />
            <h2 className="text-sm font-black text-white font-heading tracking-tight">2. Test Cases Evaluation</h2>
          </div>
          
          <div className="p-5 space-y-6 bg-slate-950/20">
            {/* Visible Test Cases */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-black text-white">Visible Case Examples</h3>
                  <p className="text-[11px] text-slate-500">Exposed directly to users as examples inside sandbox problem descriptions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => appendVisible({ input: '', output: '', explanation: '' })}
                  className="ghost-button text-[10px] py-1.5 px-3 flex items-center gap-1"
                >
                  <Plus size={12} className="text-emerald-400" />
                  <span>Add Example</span>
                </button>
              </div>

              <div className="space-y-4">
                {visibleFields.map((field, index) => (
                  <div key={field.id} className="relative rounded-xl border border-white/5 bg-slate-950/40 p-5 pt-7 group hover:border-white/10 transition-colors">
                    <button
                      type="button"
                      onClick={() => removeVisible(index)}
                      className="absolute top-4 right-4 text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Input</label>
                        <input
                          {...register(`visibleTestCases.${index}.input`)}
                          placeholder="e.g. nums = [2,7,11,15], target = 9"
                          className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-lg text-xs py-2 px-3"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Expected Output</label>
                        <input
                          {...register(`visibleTestCases.${index}.output`)}
                          placeholder="e.g. [0,1]"
                          className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-lg text-xs py-2 px-3"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Explanation</label>
                        <textarea
                          {...register(`visibleTestCases.${index}.explanation`)}
                          rows={2}
                          placeholder="Because nums[0] + nums[1] == 9, we return [0, 1]."
                          className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-lg text-xs py-2 px-3 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {errors.visibleTestCases && <span className="text-red-500 text-xs">{errors.visibleTestCases.message}</span>}
              </div>
            </div>

            {/* Hidden Test Cases */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-xs font-black text-white">Hidden Sandbox Evaluators</h3>
                  <p className="text-[11px] text-slate-500">Passed background-compilers to check execution correctness on submissions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => appendHidden({ input: '', output: '' })}
                  className="ghost-button text-[10px] py-1.5 px-3 flex items-center gap-1"
                >
                  <Plus size={12} className="text-emerald-400" />
                  <span>Add Hidden Case</span>
                </button>
              </div>

              <div className="space-y-4">
                {hiddenFields.map((field, index) => (
                  <div key={field.id} className="relative rounded-xl border border-white/5 bg-slate-950/40 p-5 pt-7 group hover:border-white/10 transition-colors">
                    <button
                      type="button"
                      onClick={() => removeHidden(index)}
                      className="absolute top-4 right-4 text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Input</label>
                        <input
                          {...register(`hiddenTestCases.${index}.input`)}
                          placeholder="e.g. nums = [3,2,4], target = 6"
                          className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-lg text-xs py-2 px-3"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Expected Output</label>
                        <input
                          {...register(`hiddenTestCases.${index}.output`)}
                          placeholder="e.g. [1,2]"
                          className="w-full premium-input bg-[#0f172a] border border-white/10 text-slate-200 outline-none rounded-lg text-xs py-2 px-3"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {errors.hiddenTestCases && <span className="text-red-500 text-xs">{errors.hiddenTestCases.message}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Code Templates */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2">
            <Code2 size={16} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white font-heading tracking-tight">3. Code Contexts Templates</h2>
          </div>
          
          <div className="p-5 space-y-6 bg-slate-950/20">
            {[0, 1, 2].map((index) => {
              const langMap = { 0: 'C++', 1: 'Java', 2: 'JavaScript' };
              const langColorMap = { 0: 'border-blue-500/10 bg-blue-500/5 text-blue-300', 1: 'border-orange-500/10 bg-orange-500/5 text-orange-300', 2: 'border-yellow-500/10 bg-yellow-500/5 text-yellow-300' };
              
              return (
                <div key={index} className="rounded-xl border border-white/5 overflow-hidden">
                  <div className={`px-4 py-3 border-b border-white/5 flex items-center gap-2 text-xs font-black uppercase tracking-wider ${langColorMap[index]}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{langMap[index]} Environment</span>
                  </div>
                  
                  <div className="p-5 bg-slate-950/40 grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Boilerplate (Start Code)</label>
                      <textarea
                        {...register(`startCode.${index}.initialCode`)}
                        rows={10}
                        className={`w-full bg-[#020617] text-slate-300 font-mono p-4 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 border border-white/10 transition-all ${errors?.startCode?.[index]?.initialCode ? 'border-red-500' : ''}`}
                      />
                      {errors?.startCode?.[index]?.initialCode && <span className="text-red-500 text-xs mt-1.5 block px-1">{errors.startCode[index].initialCode.message}</span>}
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Reference Solution (Admin)</label>
                      <textarea
                        {...register(`referenceSolution.${index}.completeCode`)}
                        rows={10}
                        className={`w-full bg-[#020617] text-slate-300 font-mono p-4 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 border border-white/10 transition-all ${errors?.referenceSolution?.[index]?.completeCode ? 'border-red-500' : ''}`}
                      />
                      {errors?.referenceSolution?.[index]?.completeCode && <span className="text-red-500 text-xs mt-1.5 block px-1">{errors.referenceSolution[index].completeCode.message}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-center pt-4">
          <button 
            type="submit" 
            disabled={isSaving}
            className="premium-button text-sm uppercase tracking-wider font-black py-3.5 px-10 shadow-[0_0_20px_rgba(52,211,153,0.15)] max-w-sm w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-xs text-slate-950"></span>
                <span>Publishing Problem...</span>
              </>
            ) : (
              <span>Publish Problem</span>
            )}
          </button>
        </div>
      </form>
    </AppShell>
  );
}

export default AdminPanel;