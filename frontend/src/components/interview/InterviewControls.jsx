/**
 * @file InterviewControls.jsx
 * @summary Control panel component for the AI Interview Copilot. It supports dual modes: text-based chat 
 *          and voice-based speech dictation. Includes selectors for interview difficulty, actions to trigger 
 *          questions, follow-ups, and scorecards, Text-to-Speech synthesis settings (voice select, volume, rate, pitch), 
 *          and real-time Speech-to-Text transcription preview.
 * 
 * @functions
 * - InterviewControls: Main functional component that binds parent state, handles locks, and renders layout states.
 * - useEffect (Captured): Monitors changes in mic listening status and alerts when voice input is successfully captured.
 * - handleEndClick: Implements a double-confirmation timeout guard for ending interviews and generating scorecards.
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Loader2, 
  Mic, 
  Send, 
  SlidersHorizontal, 
  Square, 
  Volume2, 
  VolumeX, 
  Zap, 
  Lock, 
  CheckCircle2, 
  ChevronDown, 
  AlertCircle 
} from "lucide-react";

function InterviewControls({
  mode,
  answer,
  difficulty,
  loadingAction,
  canSubmit,
  disabled = false,
  isCompleted = false,
  canGenerateFollowUp = true,
  canGenerateScorecard = true,
  onAnswerChange,
  onDifficultyChange,
  onGenerateQuestion,
  onSubmitAnswer,
  onGenerateFollowUp,
  onGenerateScorecard,
  isListening,
  isSpeaking,
  isInitializing = false,
  isMicActive = false,
  speechVolume = 1,
  onSpeechVolumeChange = () => {},
  speechError = "",
  onClearSpeechError = () => {},
  interimTranscript,
  recognitionSupported,
  synthesisSupported,
  voices,
  selectedVoiceURI,
  speechRate,
  speechPitch,
  currentQuestionText,
  onStartListening,
  onStopListening,
  onPlayQuestion,
  onStopSpeaking,
  onSelectedVoiceChange,
  onSpeechRateChange,
  onSpeechPitchChange
}) {
  const isBusy = Boolean(loadingAction);
  const locked = isCompleted || isBusy;

  // Voice captured status tracker
  const [captured, setCaptured] = useState(false);
  const prevListening = useRef(isListening);

  useEffect(() => {
    if (prevListening.current && !isListening && answer) {
      setCaptured(true);
      const timer = setTimeout(() => setCaptured(false), 2000);
      return () => clearTimeout(timer);
    }
    prevListening.current = isListening;
  }, [isListening, answer]);

  // End interview double confirmation tracker
  const [confirmEnd, setConfirmEnd] = useState(false);

  const handleEndClick = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      const timer = setTimeout(() => setConfirmEnd(false), 4000);
      return () => clearTimeout(timer);
    } else {
      onGenerateScorecard();
      setConfirmEnd(false);
    }
  };

  return (
    <section className="premium-card overflow-hidden bg-slate-900/80 shadow-xl border border-white/8 relative">
      {/* Visual Lock Overlay for Completed Interviews */}
      {isCompleted && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2.5px] z-20 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(52,211,153,0.2)] mb-4 animate-glow-pulse">
            <Lock size={24} className="stroke-[2.5]" />
          </div>
          <h3 className="text-base font-black text-white font-heading tracking-tight">Interview Session Completed</h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed font-semibold">
            All responses have been submitted and evaluated. Streaks and stats have been updated in your profile dashboard.
          </p>
        </div>
      )}

      {/* Session Complete Banner */}
      {isCompleted && (
        <div className="bg-emerald-500/10 border-b border-emerald-400/20 px-4 py-3 flex items-center gap-2.5 text-xs text-emerald-400 font-extrabold select-none animate-fade-up">
          <CheckCircle2 size={15} />
          <span>Session Complete — Start a new interview from the start page.</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="p-4 border-b border-white/8 bg-slate-900/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={difficulty}
              onChange={(event) => onDifficultyChange(event.target.value)}
              disabled={disabled}
              className="premium-input text-xs font-bold bg-[#0f172a] border border-white/10 rounded-lg py-2 pl-3 pr-8 focus:border-emerald-400 outline-none appearance-none cursor-pointer text-slate-200"
            >
              <option value="easy">Easy Round</option>
              <option value="medium">Medium Round</option>
              <option value="hard">Hard Round</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={onGenerateQuestion}
            disabled={locked}
            className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5"
          >
            {isCompleted ? (
              <>
                <Lock size={13} />
                <span>Locked</span>
              </>
            ) : loadingAction === "question" ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Zap size={13} />
                <span>Generate Question</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onGenerateFollowUp}
            disabled={locked || !canGenerateFollowUp}
            className="ghost-button text-xs py-2 px-4 flex items-center gap-1"
          >
            {loadingAction === "followup" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <span>Follow-Up</span>
            )}
          </button>
          
          <button
            onClick={handleEndClick}
            disabled={locked || !canGenerateScorecard}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              confirmEnd 
                ? "bg-red-600 text-white animate-glow-pulse" 
                : "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {loadingAction === "scorecard" ? (
              <span className="flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Ending...</span>
            ) : confirmEnd ? (
              "Confirm End?"
            ) : (
              "End Interview"
            )}
          </button>
        </div>
      </div>

      {/* Mode Panel Areas */}
      {mode === "chat" ? (
        <div className="p-4 space-y-4">
          {/* Question Audio Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPlayQuestion}
              disabled={disabled || !currentQuestionText || !synthesisSupported}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                isSpeaking 
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-300" 
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              } disabled:opacity-40`}
            >
              <Volume2 size={14} className={isSpeaking ? "animate-pulse" : ""} />
              <span>{isSpeaking ? "Playing Question..." : "Play Question"}</span>
            </button>
            
            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <VolumeX size={14} />
                <span>Stop</span>
              </button>
            )}
          </div>

          {/* Chat Answer Box */}
          <div className="relative">
            <textarea
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={disabled}
              placeholder="Type your structured technical answer here..."
              rows={6}
              className="w-full premium-input bg-slate-950/50 p-4 text-sm leading-relaxed outline-none resize-none focus:border-emerald-400 text-slate-100"
            />
            
            {/* Character Count */}
            <div className="absolute right-3.5 bottom-3.5 text-[10px] font-bold text-slate-500 tracking-wider">
              {answer ? `${answer.length} chars` : "0 chars"}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={onSubmitAnswer}
              disabled={locked || !canSubmit}
              className="premium-button text-xs font-black uppercase tracking-wider py-2.5 px-5 flex items-center gap-2"
            >
              {loadingAction === "answer" ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit Answer</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Main Pulsing Mic Circle with responsive Multi-State mapping */}
          <div className="flex flex-col items-center justify-center py-8 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden">
            {/* Absolute Status Badge in the top right corner of the mic card */}
            <div className="absolute top-3 right-3 select-none z-10">
              {isMicActive ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)] animate-fade-in">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mic Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800/40 border border-white/5 text-slate-400 animate-fade-in">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Mic Muted
                </span>
              )}
            </div>

            {/* Absolute accent background glow to reflect voice active status */}
            <div className={`absolute w-36 h-36 rounded-full blur-[50px] opacity-15 pointer-events-none transition-colors duration-500 ${
              isSpeaking 
                ? "bg-cyan-500" 
                : isMicActive && isListening 
                ? "bg-red-500 animate-pulse" 
                : "bg-emerald-500"
            }`} />

            {/* Circular Button */}
            {isSpeaking ? (
              // AI is Speaking State: click triggers Stop Voice / Mute instantly (Interruptible UX)
              <button
                onClick={onStopSpeaking}
                disabled={disabled}
                title="Click to interrupt AI voice"
                className="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-cyan-400 text-slate-950 scale-105 shadow-[0_0_30px_rgba(34,211,238,0.3)] animate-speaking-wave hover:scale-110 active:scale-95 transition-all duration-300 relative z-10"
              >
                <VolumeX size={30} className="animate-pulse stroke-[2.5]" />
              </button>
            ) : isInitializing ? (
              // Calibrating / Initializing mic State: provides immediate responsive feedback
              <button
                disabled
                className="w-20 h-20 rounded-full flex items-center justify-center bg-[#0f172a] text-[#34d399]/40 border border-white/8 scale-95 shadow-inner cursor-wait relative z-10"
              >
                <Loader2 size={30} className="animate-spin text-emerald-400" />
              </button>
            ) : isMicActive ? (
              // Active Candidate Listening State: click triggers Stop Listening (Mute Mic)
              <button
                onClick={onStopListening}
                disabled={locked}
                title="Click to mute microphone"
                className="w-20 h-20 rounded-full flex items-center justify-center bg-red-500 text-white animate-mic-pulse scale-105 shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:scale-110 active:scale-95 transition-all duration-300 relative z-10"
              >
                <Square size={24} className="stroke-[2.5] fill-white animate-pulse" />
              </button>
            ) : (
              // Idle State: ready for record triggering
              <button
                onClick={onStartListening}
                disabled={locked || !recognitionSupported}
                title="Click to activate microphone"
                className="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 shadow-2xl hover:bg-emerald-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(52,211,153,0.35)] active:scale-95 transition-all duration-300 relative z-10"
              >
                <Mic size={30} className="stroke-[2.5]" />
              </button>
            )}

            {/* Visual State Labels */}
            <p className="mt-4 text-xs font-black uppercase tracking-wider select-none relative z-10 text-center">
              {loadingAction === "answer" ? (
                <span className="text-amber-400 flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  Evaluating Answer &amp; Submitting...
                </span>
              ) : loadingAction === "question" || loadingAction === "followup" ? (
                <span className="text-cyan-400 flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  Generating next question...
                </span>
              ) : loadingAction === "scorecard" ? (
                <span className="text-red-400 flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  Generating final assessment...
                </span>
              ) : isSpeaking ? (
                <span className="text-cyan-400 flex items-center justify-center gap-1.5 animate-pulse">
                  <Volume2 size={12} className="animate-bounce" />
                  AI is Speaking...
                </span>
              ) : isInitializing ? (
                <span className="text-amber-300 flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 size={12} className="animate-spin text-amber-300" />
                  Initializing Mic...
                </span>
              ) : isListening ? (
                interimTranscript ? (
                  <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Processing Speech...
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                    Listening... Speak now
                  </span>
                )
              ) : isMicActive ? (
                <span className="text-emerald-300 flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Ready
                </span>
              ) : (
                <span className="text-slate-400 flex items-center justify-center gap-1.5">
                  Mic Muted / Tap to Speak
                </span>
              )}
            </p>

            {/* Dynamic CSS Waveform Visualizer (Appears when Mic is Active and Listening) */}
            {isMicActive && isListening && (
              <div className="voice-wave-container mt-4 animate-fade-in relative z-10">
                <span className="voice-bar animate-bar-1" />
                <span className="voice-bar animate-bar-2" />
                <span className="voice-bar animate-bar-3" />
                <span className="voice-bar animate-bar-4" />
                <span className="voice-bar animate-bar-5" />
                <span className="voice-bar animate-bar-6" />
                <span className="voice-bar animate-bar-7" />
              </div>
            )}
          </div>

          {/* Inline Speech Synthesis Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-center">
            <button
              onClick={onPlayQuestion}
              disabled={disabled || !currentQuestionText || !synthesisSupported || isSpeaking}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                isSpeaking 
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-300" 
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              } disabled:opacity-40`}
            >
              <Volume2 size={14} className={isSpeaking ? "animate-pulse" : ""} />
              <span>Play Question Voice</span>
            </button>

            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <VolumeX size={14} />
                <span>Stop Voice</span>
              </button>
            )}
          </div>

          {/* Speech Engine Alerts */}
          {(!recognitionSupported || !synthesisSupported) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                {!recognitionSupported && <p>Voice Speech Recognition is not supported by your current browser (Chrome is recommended).</p>}
                {!synthesisSupported && <p>Voice Speech Synthesis (Text-to-Speech) is not supported by your current browser.</p>}
              </div>
            </div>
          )}

          {/* Collapsible Voice Settings */}
          <details className="group rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3.5 text-xs font-black uppercase tracking-wider text-slate-400 cursor-pointer list-none select-none hover:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-emerald-400 animate-glow-pulse" />
                <span>Voice Settings Engine</span>
              </div>
              <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" />
            </summary>
            
            <div className="p-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/20">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Voice Tone</label>
                <select
                  value={selectedVoiceURI}
                  onChange={(event) => onSelectedVoiceChange(event.target.value)}
                  disabled={disabled || !synthesisSupported || voices.length === 0}
                  className="w-full premium-input text-xs font-bold bg-[#0f172a] border border-white/10 rounded-lg py-2 focus:border-emerald-400 outline-none disabled:opacity-50 text-slate-200"
                >
                  {voices.length === 0 ? (
                    <option value="">Default browser voice</option>
                  ) : (
                    voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Speech Volume</span>
                  <span className="text-emerald-400">{Math.round(speechVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={speechVolume}
                  onChange={(event) => onSpeechVolumeChange(Number(event.target.value))}
                  disabled={disabled}
                  className="range range-xs select-emerald bg-white/10 accent-emerald-400 w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Speech Rate</span>
                  <span className="text-emerald-400">{speechRate}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.1"
                  value={speechRate}
                  onChange={(event) => onSpeechRateChange(event.target.value)}
                  disabled={disabled}
                  className="range range-xs select-emerald bg-white/10 accent-emerald-400 w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Pitch Level</span>
                  <span className="text-emerald-400">{speechPitch}</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.1"
                  value={speechPitch}
                  onChange={(event) => onSpeechPitchChange(event.target.value)}
                  disabled={disabled}
                  className="range range-xs select-emerald bg-white/10 accent-emerald-400 w-full"
                />
              </div>
            </div>
          </details>

          {/* Localized Voice Status Warning */}
          {speechError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400 flex items-start justify-between gap-3 animate-fade-up">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <div>
                  <p className="font-extrabold uppercase text-[10px] tracking-wider text-red-400">Microphone Status Alert</p>
                  <p className="mt-0.5 leading-relaxed font-semibold text-red-300">{speechError}</p>
                </div>
              </div>
              <button 
                onClick={onClearSpeechError} 
                className="text-[10px] font-black uppercase text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/5 shrink-0 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Voice Text Preview & Live Transcription Area */}
          <div className="space-y-3">
            {/* Real-time Glassmorphic Transcription Overlay */}
            {(isMicActive || isListening || isInitializing || interimTranscript || answer) && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-inner relative overflow-hidden animate-fade-in backdrop-blur-md">
                {/* Top Live Indicator */}
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 select-none">
                  <span className={`h-1.5 w-1.5 rounded-full ${isListening ? "bg-red-500 animate-ping" : "bg-emerald-400"}`} />
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isListening ? "text-red-400" : "text-emerald-400"}`}>
                    {isInitializing ? "Initializing..." : isListening ? "Live Stream" : "Processed"}
                  </span>
                </div>
                
                <div className="flex items-start gap-2 max-w-[90%]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mt-0.5 shrink-0 select-none">
                    Dictation:
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed font-semibold break-words">
                    {answer || interimTranscript ? (
                      <p>
                        <span className="text-slate-300">{answer}</span>
                        {interimTranscript && (
                          <span className="text-emerald-400 font-extrabold italic animate-pulse ml-1">
                            {interimTranscript}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-500 italic">Waiting for speech...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                disabled={disabled}
                placeholder="Spoken answers will be transcribed here. You can manually edit or refine before clicking submit."
                rows={5}
                className="w-full premium-input bg-slate-950/50 p-4 text-sm leading-relaxed outline-none resize-none focus:border-emerald-400 text-slate-100"
              />
              
              {/* Character Count */}
              <div className="absolute right-3.5 bottom-3.5 text-[10px] font-bold text-slate-500 tracking-wider">
                {answer ? `${answer.length} chars` : "0 chars"}
              </div>
            </div>

            {/* Captured ✓ Notification popup */}
            {captured && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 font-extrabold flex items-center gap-1.5 animate-fade-up">
                <CheckCircle2 size={14} />
                <span>Voice captured ✓ Ready to submit</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={onSubmitAnswer}
                disabled={locked || !canSubmit}
                className="premium-button text-xs font-black uppercase tracking-wider py-2.5 px-5 flex items-center gap-2"
              >
                {loadingAction === "answer" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default InterviewControls;
