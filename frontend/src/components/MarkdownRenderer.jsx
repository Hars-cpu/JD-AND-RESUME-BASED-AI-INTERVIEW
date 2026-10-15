/**
 * @file MarkdownRenderer.jsx
 * @summary A custom React markdown engine that parses markdown strings into structured components. 
 *          It styles standard markdown (headings, lists, blockquotes, tables, inline text) and highlights 
 *          code blocks without external libraries or unsafe HTML injections. Additionally, it groups 
 *          complexity stats, debug feedback cards, and collapsible hints into interactive UI widgets.
 * 
 * @functions
 * - renderInlineText: Parses and formatting text containing markdown inline elements (`code`, **bold**, *italic*).
 * - highlightCode: Tokenizes syntax (keywords, strings, comments, numbers) into colored span elements.
 * - CodeBlock: Displays styled, scrollable code snippets with a functional copy-to-clipboard button.
 * - parseMarkdown: Parses lines of raw markdown text into arrays of structural semantic block objects.
 * - postProcessBlocks: Groups semantic blocks into interactive card layouts (like hints, complexity boxes, and review sections).
 * - renderTable: Renders markdown table format (`|`) as standard HTML tables with responsive layouts.
 * - renderSubBlock: Maps parsed blocks (like paragraphs, tables, lists, code) to their JSX elements.
 * - MarkdownRenderer: Main exported component orchestrating the parser, post-processor, and layout output.
 */
import React, { useState } from "react";
import { 
  ChevronDown, 
  Clock, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Copy, 
  Check 
} from "lucide-react";

// Inline text formatting helper (bold, italic, code tags)
const renderInlineText = (text) => {
  if (!text) return "";
  
  // Interview Note: HTML stripping regex (/<[^>]*>/g) is used here. 
  // Interviewer Question: "Is this secure against XSS?" 
  // Answer: Yes, because React escapes text nodes by default. This regex is just to clean layout tags.
  // Note: HTML is not a regular language, so regex-based parsing/stripping has edge cases but is sufficient here.
  // Strip any raw HTML/JSX tags to prevent Tailwind CSS class leakage
  const cleanedText = typeof text === "string" ? text.replace(/<[^>]*>/g, "") : text;
  
  const parts = [];
  let index = 0;
  
  // Match bold (**text**), italic (*text*), and inline code (`code`)
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let match;
  
  while ((match = pattern.exec(cleanedText)) !== null) {
    const textBefore = cleanedText.substring(index, match.index);
    if (textBefore) {
      parts.push(textBefore);
    }
    
    if (match[1]) {
      parts.push(
        <code 
          key={match.index} 
          className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/8 font-mono text-[11px] sm:text-xs text-cyan-300 font-semibold"
        >
          {match[1]}
        </code>
      );
    } else if (match[2]) {
      parts.push(<strong key={match.index} className="font-extrabold text-white">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic text-slate-300">{match[3]}</em>);
    }
    
    index = pattern.lastIndex;
  }
  
  const textAfter = cleanedText.substring(index);
  if (textAfter) {
    parts.push(textAfter);
  }
  
  return parts.length ? parts : cleanedText;
};

// Interview Note: Custom Regex Tokenizer vs dangerouslySetInnerHTML.
// Interviewer Question: "Why avoid dangerouslySetInnerHTML for syntax highlighting?"
// Answer: (1) Security (XSS prevention). (2) Stability (avoids double-replacement browser bugs).
// (3) Performance/Diffing: Emitting individual React span components allows React's VDOM to diff changes cleanly.
// Syntax highlighting renderer using a safe React tokenizer (no dangerouslySetInnerHTML double-replace bugs)
const highlightCode = (code, lang) => {
  if (!code) return "";
  
  const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\/|#.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|class|return|import|export|default|if|else|for|while|do|switch|case|break|continue|def|elif|from|as|public|private|protected|void|int|double|float|char|string|struct|typename|new|delete|this)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*)|(\s+)|(.)/g;

  const parts = [];
  let match;
  let key = 0;
  
  tokenRegex.lastIndex = 0;
  
  while ((match = tokenRegex.exec(code)) !== null) {
    const [
      full,
      comment,
      string,
      number,
      keyword,
      identifier,
      whitespace,
      other
    ] = match;
    
    if (comment) {
      parts.push(<span key={key++} className="text-slate-500 italic">{comment}</span>);
    } else if (string) {
      parts.push(<span key={key++} className="text-emerald-400">{string}</span>);
    } else if (number) {
      parts.push(<span key={key++} className="text-amber-300 font-semibold">{number}</span>);
    } else if (keyword) {
      parts.push(<span key={key++} className="text-cyan-400 font-extrabold">{keyword}</span>);
    } else if (identifier) {
      parts.push(identifier);
    } else if (whitespace) {
      parts.push(whitespace);
    } else if (other) {
      parts.push(other);
    }
  }
  
  return <code className="block select-text whitespace-pre leading-relaxed">{parts.length ? parts : code}</code>;
};

// Interactive Code Block Component
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);

  // Interview Note: Clipboard API and Timeout Cleanup.
  // Interviewer Question: "What is a potential issue with this handleCopy implementation?"
  // Answer: If the component unmounts within 2 seconds of clicking Copy, the setTimeout callback triggers setCopied,
  // which attempts to update state on an unmounted component (causing a memory leak warning in older React versions).
  // A robust fix would store the timeout ID and clear it on unmount.
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative border border-white/8 rounded-xl overflow-hidden bg-slate-950 my-4 shadow-2xl font-mono text-[11px] sm:text-xs animate-fade-in w-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/60 select-none text-[9px] font-black uppercase tracking-wider text-slate-400">
        <span className="text-cyan-400 font-extrabold">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 max-h-[380px] premium-scrollbar">
        <pre className="text-slate-100 whitespace-pre leading-relaxed select-text">
          {highlightCode(code, lang)}
        </pre>
      </div>
    </div>
  );
}

// Interview Note: Single-pass State Machine Parser.
// Interviewer Question: "How does this parser resolve blocks (headings, code blocks, lists)?"
// Answer: It reads the content line-by-line, updating the state of `currentBlock` depending on matches (state machine).
// Pre-processing code fences via regex normalization prevents layout breakages when LLM formatting lacks newlines.
// Markdown parser and block separator
const parseMarkdown = (text) => {
  if (!text) return [];
  
  // Ensure markdown code fences are always on their own line
  const formattedText = text
    .replace(/([^\n])```/g, "$1\n```")
    .replace(/```([^\n])/g, "```\n$1");

  const blocks = [];
  const lines = formattedText.split('\n');
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (currentBlock && currentBlock.type === 'code') {
        blocks.push(currentBlock);
        currentBlock = null;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        const lang = line.trim().substring(3).trim();
        currentBlock = { type: 'code', lang: lang || 'plaintext', lines: [] };
      }
      continue;
    }

    if (currentBlock && currentBlock.type === 'code') {
      currentBlock.lines.push(line);
      continue;
    }

    if (line.trim().startsWith('|')) {
      if (currentBlock && currentBlock.type === 'table') {
        currentBlock.rows.push(line);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'table', rows: [line] };
      }
      continue;
    }

    if (currentBlock && currentBlock.type === 'table') {
      blocks.push(currentBlock);
      currentBlock = null;
    }

    if (line.trim().match(/^---+$|^\*\*\*+$/)) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({ type: 'divider' });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      const level = headingMatch[1].length;
      const content = headingMatch[2].trim();
      blocks.push({ type: 'heading', level, content });
      continue;
    }

    if (line.trim().startsWith('>')) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      const content = line.trim().substring(1).trim();
      blocks.push({ type: 'blockquote', content });
      continue;
    }

    const uListMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (uListMatch) {
      if (currentBlock && currentBlock.type === 'ulist') {
        currentBlock.items.push(uListMatch[1]);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'ulist', items: [uListMatch[1]] };
      }
      continue;
    }

    const oListMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (oListMatch) {
      if (currentBlock && currentBlock.type === 'olist') {
        currentBlock.items.push(oListMatch[1]);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'olist', items: [oListMatch[1]] };
      }
      continue;
    }

    if (currentBlock && (currentBlock.type === 'ulist' || currentBlock.type === 'olist')) {
      blocks.push(currentBlock);
      currentBlock = null;
    }

    if (line.trim() === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    if (currentBlock && currentBlock.type === 'paragraph') {
      currentBlock.content += '\n' + line;
    } else {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = { type: 'paragraph', content: line };
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
};

// Interview Note: Time Complexity optimization in lookahead loop.
// Interviewer Question: "Is this nested loop O(N^2) complexity?"
// Answer: No, it is O(N) linear time because the outer loop index `i` is fast-forwarded to `j - 1` after the inner
// lookahead loop finishes, meaning each block is visited at most a constant number of times.
// Groups text blocks into interactive layouts
const postProcessBlocks = (blocks) => {
  const processed = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    // 1. Group hints and capture all subsequent non-heading, non-divider blocks
    if (block.type === 'heading' && block.content.toLowerCase().includes('hint')) {
      const hintContentBlocks = [];
      let j = i + 1;
      while (j < blocks.length && blocks[j].type !== 'heading' && blocks[j].type !== 'divider') {
        hintContentBlocks.push(blocks[j]);
        j++;
      }
      if (hintContentBlocks.length > 0) {
        processed.push({
          type: 'hint',
          title: block.content,
          contentBlocks: hintContentBlocks
        });
        i = j - 1;
        continue;
      }
    }
    
    // 2. Group complexity values
    if (block.type === 'paragraph') {
      const tcMatch = block.content.match(/(?:time\s+complexity|tc)\s*:\s*(`[^`]+`|\S+)/i);
      const scMatch = block.content.match(/(?:space\s+complexity|sc)\s*:\s*(`[^`]+`|\S+)/i);
      if (tcMatch || scMatch) {
        processed.push({
          type: 'complexity',
          time: tcMatch ? tcMatch[1].replace(/`/g, '') : null,
          space: scMatch ? scMatch[1].replace(/`/g, '') : null,
          rawText: block.content
        });
        continue;
      }
    }

    // 3. Group structured review/debug sections and capture all subsequent blocks under them
    if (block.type === 'heading' && (
      block.content.toLowerCase().includes('issues found') ||
      block.content.toLowerCase().includes('suggested fixes') ||
      block.content.toLowerCase().includes('optimized version') ||
      block.content.toLowerCase().includes('problem') ||
      block.content.toLowerCase().includes('root cause') ||
      block.content.toLowerCase().includes('fix')
    )) {
      const reviewContentBlocks = [];
      let j = i + 1;
      while (j < blocks.length && blocks[j].type !== 'heading' && blocks[j].type !== 'divider') {
        reviewContentBlocks.push(blocks[j]);
        j++;
      }
      if (reviewContentBlocks.length > 0) {
        processed.push({
          type: 'review_section',
          title: block.content,
          contentBlocks: reviewContentBlocks
        });
        i = j - 1;
        continue;
      }
    }
    
    processed.push(block);
  }
  return processed;
};

// Renders markdown tables
const renderTable = (rows, index) => {
  if (rows.length < 2) return null;
  
  const parseRow = (row) => row.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
  const headers = parseRow(rows[0]);
  const bodyRows = rows.slice(2).map(parseRow); // skip header and divider

  return (
    <div key={index} className="overflow-x-auto my-4 w-full border border-white/5 rounded-xl bg-slate-950/40 premium-scrollbar shadow-inner animate-fade-in">
      <table className="min-w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-white/8 bg-slate-900/60 font-black text-slate-300 uppercase tracking-wider select-none">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-4 py-3">{renderInlineText(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Unified helper to render sub-blocks cleanly (reducing duplicate styles)
const renderSubBlock = (subBlock, subIdx) => {
  switch (subBlock.type) {
    case 'paragraph':
      return (
        <p key={subIdx} className="text-slate-300 leading-relaxed font-semibold">
          {renderInlineText(subBlock.content)}
        </p>
      );
    case 'ulist':
      return (
        <ul key={subIdx} className="list-disc pl-5 my-1.5 space-y-1.5 text-slate-300 font-semibold">
          {subBlock.items.map((item, i) => (
            <li key={i}>{renderInlineText(item)}</li>
          ))}
        </ul>
      );
    case 'olist':
      return (
        <ol key={subIdx} className="list-decimal pl-5 my-1.5 space-y-1.5 text-slate-300 font-semibold">
          {subBlock.items.map((item, i) => (
            <li key={i}>{renderInlineText(item)}</li>
          ))}
        </ol>
      );
    case 'code':
      return <CodeBlock key={subIdx} lang={subBlock.lang} code={subBlock.lines.join('\n')} />;
    case 'table':
      return renderTable(subBlock.rows, subIdx);
    default:
      return null;
  }
};

export function MarkdownRenderer({ text }) {
  const blocks = postProcessBlocks(parseMarkdown(text));

  return (
    <div className="space-y-3 leading-relaxed text-slate-300 max-w-full text-xs sm:text-sm">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const hTagLevel = Math.min(6, block.level);
            const classes = {
              1: "text-lg sm:text-xl font-black text-white mt-4 mb-2 tracking-tight",
              2: "text-base sm:text-lg font-black text-white mt-3.5 mb-2 border-b border-white/5 pb-1 tracking-tight",
              3: "text-sm sm:text-base font-black text-slate-100 mt-3 mb-1.5 tracking-tight",
              4: "text-xs sm:text-sm font-bold text-slate-200 mt-2.5 mb-1",
              5: "text-xs font-bold text-slate-300 mt-2",
              6: "text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wide"
            }[hTagLevel];
            
            return React.createElement(`h${hTagLevel}`, { key: idx, className: classes }, renderInlineText(block.content));
          }

          case 'divider':
            return <hr key={idx} className="my-4 border-t border-white/8" />;

          case 'blockquote':
            return (
              <blockquote key={idx} className="border-l-4 border-emerald-400 bg-white/[0.02] px-4 py-3.5 rounded-r-xl my-4 text-xs italic text-slate-400 font-medium animate-fade-in">
                {renderInlineText(block.content)}
              </blockquote>
            );

          case 'hint':
            return (
              <details 
                key={idx} 
                className="group border border-emerald-500/20 bg-emerald-500/5 rounded-xl my-3 overflow-hidden transition-all duration-300 shadow-lg shadow-emerald-950/10 animate-fade-in"
              >
                <summary className="flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-400 cursor-pointer select-none hover:bg-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={14} className="animate-glow-pulse text-emerald-400" />
                    <span>{block.title.replace(/^#+\s*/, '')}</span>
                  </div>
                  <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180 text-emerald-400" />
                </summary>
                <div className="px-4 py-3 border-t border-emerald-500/10 text-slate-300 leading-relaxed font-semibold space-y-2">
                  {block.contentBlocks.map((subBlock, subIdx) => renderSubBlock(subBlock, subIdx))}
                </div>
              </details>
            );

          case 'complexity':
            return (
              <div key={idx} className="flex flex-wrap gap-4 my-4 animate-fade-in">
                {block.time && (
                  <div className="flex items-center gap-3 border border-cyan-500/20 bg-cyan-950/20 px-4 py-2 rounded-2xl shadow-lg hover:border-cyan-500/40 transition-colors select-none">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-500/10 text-cyan-400">
                      <Clock size={14} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Time Complexity</p>
                      <p className="font-mono text-xs font-bold text-cyan-300 mt-0.5">{block.time}</p>
                    </div>
                  </div>
                )}
                {block.space && (
                  <div className="flex items-center gap-3 border border-violet-500/20 bg-violet-950/20 px-4 py-2 rounded-2xl shadow-lg hover:border-violet-500/40 transition-colors select-none">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/10 text-violet-400">
                      <Cpu size={14} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Space Complexity</p>
                      <p className="font-mono text-xs font-bold text-violet-300 mt-0.5">{block.space}</p>
                    </div>
                  </div>
                )}
                {!block.time && !block.space && (
                  <p className="font-semibold text-slate-300">{renderInlineText(block.rawText)}</p>
                )}
              </div>
            );

          case 'review_section': {
            const lowTitle = block.title.toLowerCase();
            const isRed = lowTitle.includes('issue') || lowTitle.includes('problem') || lowTitle.includes('bug') || lowTitle.includes('error');
            const isAmber = lowTitle.includes('suggested') || lowTitle.includes('root') || lowTitle.includes('cause') || lowTitle.includes('improvement');
            
            let cardStyle = "border-emerald-500/20 bg-emerald-500/5 shadow-emerald-950/20";
            let titleColor = "text-emerald-400";
            let iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
            let Icon = CheckCircle2;
            let label = "Solution Card";

            if (isRed) {
              cardStyle = "border-red-500/20 bg-red-500/5 shadow-red-950/20";
              titleColor = "text-red-400";
              iconColor = "text-red-400 bg-red-500/10 border-red-500/20";
              Icon = AlertTriangle;
              label = "Debug & Issue Card";
            } else if (isAmber) {
              cardStyle = "border-amber-500/20 bg-amber-500/5 shadow-amber-950/20";
              titleColor = "text-amber-400";
              iconColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
              Icon = AlertTriangle;
              label = "Analysis & Feedback Card";
            }

            return (
              <div key={idx} className={`rounded-2xl border p-5 my-5 shadow-xl animate-fade-in transition-all duration-300 hover:scale-[1.01] ${cardStyle}`}>
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 select-none">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-8 w-8 place-items-center rounded-xl border ${iconColor}`}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <span className={`text-xs font-black uppercase tracking-wider ${titleColor}`}>{block.title.replace(/^#+\s*/, '')}</span>
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mt-0.5">{label}</p>
                    </div>
                  </div>
                </div>
                <div className="text-slate-300 leading-relaxed space-y-3 pl-1 font-semibold text-xs sm:text-sm">
                  {block.contentBlocks.map((subBlock, subIdx) => renderSubBlock(subBlock, subIdx))}
                </div>
              </div>
            );
          }

          default:
            return renderSubBlock(block, idx);
        }
      })}
    </div>
  );
}

export default MarkdownRenderer;
