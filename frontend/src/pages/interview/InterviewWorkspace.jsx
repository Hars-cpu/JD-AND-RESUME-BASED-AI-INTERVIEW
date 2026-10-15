/**
 * @file InterviewWorkspace.jsx
 * @description Candidate mockup sandbox workspace page. Includes timer counters,
 * status details, progress logs, real-time audio transcripts, voice capturing inputs,
 * and AI mock evaluation results.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams } from "react-router";
import { 
  ArrowLeft, 
  Clock, 
  Code2, 
  Loader2, 
  MessageSquare, 
  Mic, 
  RotateCcw, 
  Trophy, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  AlertTriangle 
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import InterviewControls from "../../components/interview/InterviewControls";
import InterviewEvaluationCard from "../../components/interview/InterviewEvaluationCard";
import InterviewQuestionCard from "../../components/interview/InterviewQuestionCard";
import InterviewTranscript from "../../components/interview/InterviewTranscript";
import { ConfirmationDialog, ErrorState, LoadingSkeleton, Toast } from "../../components/interview/FeedbackUI";

/**
 * Formats a duration in seconds into a standard MM:SS string representation.
 * @param {number} seconds - Elapsed duration in seconds
 * @returns {string} Formatted duration string
 */
const formatElapsed = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

/**
 * Calculates total session elapsed duration in seconds.
 * @param {Object} session - Interview session metadata
 * @returns {number} Elapsed seconds
 */
const getElapsedSeconds = (session) => {
  if (!session?.startedAt) return 0;
  const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const startTime = new Date(session.startedAt).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 1000));
};

/**
 * Returns question limit goals configured for the selected format.
 * @param {string} templateType - Interview layout format identifier
 * @returns {number} Question limit
 */
const getTargetQuestionCount = (templateType) => {
  if (templateType === "coding") return 5;
  if (templateType === "full-mock") return 20;
  return 10;
};

/**
 * Calculates estimated remaining session duration.
 * @param {number} questionCount - Current question index
 * @param {number} targetQuestionCount - Target limit goals
 * @returns {string} Human-readable time representation
 */
const formatRemainingTime = (questionCount, targetQuestionCount) => {
  const remainingQuestions = Math.max(0, targetQuestionCount - questionCount);
  const remainingMinutes = remainingQuestions * 2;
  if (remainingMinutes <= 0) return "0 min";
  if (remainingMinutes < 60) return `${remainingMinutes} min`;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

/**
 * Iterates transcripts backward to extract the latest dialog by role.
 * @param {Array} transcript - Transcript dialogues history list
 * @param {string} role - Target speaker role
 * @returns {Object|null} Matching dialog entry
 */
const getLatestByRole = (transcript = [], role) => {
  for (let index = transcript.length - 1; index >= 0; index--) {
    if (transcript[index]?.role === role) return transcript[index];
  }
  return null;
};

/**
 * StatTile Component
 * Renders statistical items inside dashboard card panels.
 */
function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-white font-heading">{value}</p>
    </div>
  );
}

/**
 * ProgressSummary Component
 * Renders high-level mock parameters, active time, and completion progress bars.
 */
function ProgressSummary({ elapsed, stats }) {
  return (
    <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-0.5 text-[10px] font-black uppercase text-emerald-300 select-none">
            <Clock size={11} />
            <span>Interview Progress</span>
          </div>
          <h2 className="mt-2.5 text-base font-black text-white font-heading leading-tight">
            Question {Math.min(stats.questionCount, stats.targetQuestionCount)} of {stats.targetQuestionCount}
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-semibold">
            Estimated time remaining: <span className="text-emerald-400 font-bold">{stats.estimatedTimeRemaining}</span>
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full lg:max-w-3xl">
          <StatTile label="Elapsed" value={formatElapsed(elapsed)} />
          <StatTile label="Questions" value={stats.questionCount} />
          <StatTile label="Answers" value={stats.answerCount} />
          <StatTile label="Follow-Ups" value={stats.followUpCount} />
          <StatTile label="Complete" value={`${stats.completionPercentage}%`} />
        </div>
      </div>
      
      <div className="mt-5 h-2 rounded-full bg-slate-950 border border-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(52,211,153,0.3)]"
          style={{ width: `${stats.completionPercentage}%` }}
        />
      </div>
    </section>
  );
}

function InterviewWorkspace() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [mode, setMode] = useState("chat");
  const [latestQuestionMeta, setLatestQuestionMeta] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  
  // Tab control for below xl layouts
  const [activeTab, setActiveTab] = useState("interview");

  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const isMicActiveRef = useRef(false);
  const finalSpeechRef = useRef("");
  const interimSpeechRef = useRef("");
  const manualStopRef = useRef(false);
  const listeningTimeoutRef = useRef(null);

  const transcript = session?.transcript || [];
  const currentQuestion = getLatestByRole(transcript, "interviewer");
  const latestEvaluation = getLatestByRole(transcript, "evaluation");
  const isCompleted = session?.status === "completed" || Boolean(scorecard);
  const recognitionSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthesisSupported = typeof window !== "undefined" && Boolean(window.speechSynthesis);

  const hasSubmittedCurrentQuestion = useMemo(() => {
    if (!transcript || transcript.length === 0) return false;
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].role === 'interviewer') return false;
      if (transcript[i].role === 'candidate') return true;
    }
    return false;
  }, [transcript]);

  const stats = useMemo(() => {
    const interviewerTurns = transcript.filter((item) => item.role === "interviewer");
    const followUps = interviewerTurns.filter((item) => item.questionType === "follow-up");
    const candidateTurns = transcript.filter((item) => item.role === "candidate");
    const evaluations = transcript.filter((item) => item.role === "evaluation");
    const targetQuestionCount = getTargetQuestionCount(session?.templateType);
    const questionCount = Math.max(Number(session?.questionCount) || 0, interviewerTurns.length);
    const answerCount = Math.max(Number(session?.answerCount) || 0, candidateTurns.length);
    const followUpCount = Math.max(Number(session?.followUpCount) || 0, followUps.length);
    const completionPercentage = targetQuestionCount > 0
      ? Math.min(100, Math.round((questionCount / targetQuestionCount) * 100))
      : 0;

    return {
      questionCount,
      answerCount,
      followUpCount,
      evaluationCount: evaluations.length,
      targetQuestionCount,
      completionPercentage,
      estimatedTimeRemaining: formatRemainingTime(questionCount, targetQuestionCount)
    };
  }, [session, transcript]);

  const refreshSession = async () => {
    const { data } = await axiosClient.get(`/api/interview/session/${sessionId}`);
    setSession(data);
    setElapsed(getElapsedSeconds(data));
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        setError("");
        const { data } = await axiosClient.get(`/api/interview/session/${sessionId}`);
        if (isMounted) {
          setSession(data);
          setElapsed(getElapsedSeconds(data));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.response?.data?.error || "Failed to load interview session");
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((current) => {
        if (!session || session.status === "completed") return current;
        return getElapsedSeconds(session);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!synthesisSupported) return undefined;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      setSelectedVoiceURI((currentVoiceURI) => currentVoiceURI || availableVoices[0]?.voiceURI || "");
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [synthesisSupported]);

  useEffect(() => {
    return () => {
      if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
      
      // Stop all microphone tracks
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch (e) {}
        mediaStreamRef.current = null;
      }

      // Abort speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }

      // Cancel any ongoing text synthesis
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
    };
  }, []);

  const runAction = async (actionName, action) => {
    try {
      setError("");
      setLoadingAction(actionName);
      await action();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Interview action failed");
    } finally {
      setLoadingAction("");
    }
  };

  const speakQuestion = (questionText) => {
    if (!questionText) {
      setError("No question is available to play yet.");
      return;
    }

    if (!synthesisSupported) {
      setError("Speech synthesis is not supported in this browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(questionText);
      const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI);

      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = Number(speechRate);
      utterance.pitch = Number(speechPitch);
      utterance.volume = Number(speechVolume);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setError("Unable to play the question aloud. Please try again.");
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      setError("Speech synthesis failed in this browser.");
    }
  };

  const stopSpeaking = () => {
    if (!synthesisSupported) {
      setError("Speech synthesis is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  };

  const clearListeningTimeout = () => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
  };

  const submitAnswerText = (answerText = answer) => {
    const normalizedAnswer = answerText.trim();
    if (!normalizedAnswer) {
      setToast({
        title: "Empty Answer",
        message: "Please speak or type an answer before submitting."
      });
      return;
    }
    if (loadingAction === "answer") {
      setToast({
        title: "Submission in Progress",
        message: "Your answer is already being submitted. Please wait."
      });
      return;
    }
    if (loadingAction === "question" || loadingAction === "followup") {
      setToast({
        title: "Generating Question",
        message: "The interviewer is currently generating the next question. Please wait."
      });
      return;
    }
    if (loadingAction === "scorecard") {
      setToast({
        title: "Ending Interview",
        message: "The interview is ending. Answer submission is locked."
      });
      return;
    }
    if (isCompleted) {
      setToast({
        title: "Interview Completed",
        message: "This interview session has ended. Submissions are disabled."
      });
      return;
    }
    if (!currentQuestion) {
      setToast({
        title: "No Question",
        message: "Please generate a question before submitting an answer."
      });
      return;
    }

    // Stop voice capture instantly to freeze transcripts and mic tracks
    stopListening();

    runAction("answer", async () => {
      const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/submit-answer`, {
        answer: normalizedAnswer
      });
      setAnswer("");
      setInterimTranscript("");
      setLatestQuestionMeta((current) => current ? { ...current, evaluation: data } : current);
      await refreshSession();
    });
  };

  const handleGenerateQuestion = () => runAction("question", async () => {
    if (isCompleted) {
      setError("This interview is completed. Start a new session to generate more questions.");
      return;
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/generate-question`, {
      difficulty
    });
    setLatestQuestionMeta(data);
    await refreshSession();
    speakQuestion(data.question);
  });

  const handleSubmitAnswer = () => submitAnswerText(answer);

  const handleGenerateFollowUp = () => runAction("followup", async () => {
    if (isCompleted) {
      setError("This interview is completed. Follow-up generation is disabled.");
      return;
    }
    if (!currentQuestion || !latestEvaluation) {
      setError("Submit and evaluate an answer before generating a follow-up.");
      return;
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/generate-followup`);
    setLatestQuestionMeta({
      ...data,
      source: "follow-up"
    });
    await refreshSession();
    speakQuestion(data.question);
  });

  const handleGenerateScorecard = () => runAction("scorecard", async () => {
    if (transcript.length === 0) {
      setError("Generate at least one question before ending the interview.");
      return;
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/generate-scorecard`);
    setScorecard(data);
    setToast({
      title: "Scorecard generated",
      message: "Your final interview assessment is ready. Achievements and streaks have been updated."
    });
    await refreshSession();
    try {
      const achievementsResponse = await axiosClient.get("/api/interview/achievements");
      const unlocked = (achievementsResponse.data?.achievements || []).filter((achievement) => achievement.unlocked);
      setToast({
        title: "Interview completed",
        message: `Current streak: ${achievementsResponse.data?.currentStreak || 0} days. ${unlocked.length} achievements unlocked.`
      });
    } catch (achievementError) {
      console.warn("Unable to refresh achievement feedback", achievementError);
    }
  });

  const startListening = async () => {
    console.log("[VoiceDiag] startListening triggered");
    if (!recognitionSupported) {
      console.log("[VoiceDiag] Speech recognition not supported in browser.");
      setSpeechError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isMicActive) {
      console.log("[VoiceDiag] isMicActive is already true, returning");
      return;
    }

    // Interrupt AI voice synthesis if it's currently speaking
    if (synthesisSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    setIsInitializing(true);
    setSpeechError("");
    setIsMicActive(true);
    isMicActiveRef.current = true;

    try {
      clearListeningTimeout();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.abort();
        } catch (e) {}
      }

      // Pre-flight permission check, but DO NOT HOLD the stream. 
      // Holding the stream blocks SpeechRecognition from accessing audio on Windows Chrome.
      console.log("[VoiceDiag] Requesting getUserMedia permission pre-flight...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log("[VoiceDiag] Pre-flight permission granted and stream closed.");
      } catch (err) {
        console.error("[VoiceDiag] Pre-flight permission denied.", err);
        throw err; // cascade to outer catch
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = "en-US";
      recognition.continuous = true; // Use continuous to prevent frequent onend cycling
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("[VoiceDiag] recognition.onstart fired");
        setSpeechError("");
        setIsListening(true);
        setIsInitializing(false);
      };

      recognition.onsoundstart = () => {
        console.log("[VoiceDiag] recognition.onsoundstart fired (sound detected)");
      };

      recognition.onspeechstart = () => {
        console.log("[VoiceDiag] recognition.onspeechstart fired (speech detected)");
      };

      recognition.onresult = (event) => {
        console.log("[VoiceDiag] recognition.onresult fired");
        let interimText = "";
        let finalText = "";

        for (let index = event.resultIndex; index < event.results.length; index++) {
          const transcriptText = event.results[index][0]?.transcript || "";
          if (event.results[index].isFinal) {
            finalText += transcriptText + " ";
          } else {
            interimText += transcriptText + " ";
          }
        }
        
        if (finalText.trim()) {
          setAnswer((prev) => {
            const base = (prev || "").trim();
            const newAnswer = base ? `${base} ${finalText.trim()}` : finalText.trim();
            console.log("[VoiceDiag] Updating answer state to:", newAnswer);
            return newAnswer;
          });
        }
        
        setInterimTranscript(interimText.trim());
      };

      recognition.onerror = (event) => {
        console.log("[VoiceDiag] recognition.onerror fired. Error code:", event.error);
        const errorMessages = {
          "not-allowed": "Microphone permission was denied. Please allow microphone access in settings.",
          "service-not-allowed": "Speech recognition service is blocked in this browser.",
          "no-speech": "No speech was detected. Please try speaking again.",
          aborted: "Listening was stopped.",
          network: "Speech recognition could not connect. Check your internet connection.",
          "audio-capture": "No microphone was found. Please connect an input device."
        };

        const errMsg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;

        // Stop voice capture completely for critical issues
        if (
          event.error === "not-allowed" || 
          event.error === "audio-capture" || 
          event.error === "service-not-allowed" || 
          event.error === "network"
        ) {
          setSpeechError(errMsg);
          stopListening();
        } else if (event.error === "no-speech") {
          console.log("[VoiceDiag] no-speech detected, will let onend handle it.");
        } else if (event.error !== "aborted") {
          setSpeechError(errMsg);
        }
      };

      recognition.onend = () => {
        console.log("[VoiceDiag] recognition.onend fired. isMicActiveRef.current:", isMicActiveRef.current);
        setInterimTranscript("");

        // Auto restart if mic toggle remains active
        if (isMicActiveRef.current) {
          try {
            console.log("[VoiceDiag] Attempting auto-restart recognition.start()...");
            recognition.start();
            console.log("[VoiceDiag] Auto-restart recognition.start() called successfully.");
          } catch (err) {
            console.warn("[VoiceDiag] Speech recognition auto-restart failed, scheduling retry:", err);
            setTimeout(() => {
              if (isMicActiveRef.current && !recognitionRef.current) {
                try {
                  console.log("[VoiceDiag] Attempting delayed retry recognition.start()...");
                  recognition.start();
                  console.log("[VoiceDiag] Delayed retry recognition.start() called successfully.");
                } catch (retryErr) {
                  console.error("[VoiceDiag] Speech recognition retry failed:", retryErr);
                }
              }
            }, 1000);
          }
        } else {
          console.log("[VoiceDiag] Mic is toggled off, not restarting.");
          setIsListening(false);
          setIsInitializing(false);
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      console.log("[VoiceDiag] Calling initial recognition.start()...");
      recognition.start();
      console.log("[VoiceDiag] Initial recognition.start() called.");
    } catch (err) {
      console.error("[VoiceDiag] Failed to start voice capture:", err);
      setIsListening(false);
      setIsInitializing(false);
      setIsMicActive(false);
      isMicActiveRef.current = false;
      recognitionRef.current = null;

      const denied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError" || err?.name === "SecurityError";
      setSpeechError(denied 
        ? "Microphone permission was denied. Please allow microphone access in browser settings." 
        : "Microphone unavailable or hardware access error."
      );
    }
  };

  const stopListening = () => {
    setIsMicActive(false);
    isMicActiveRef.current = false;
    setIsListening(false);
    setIsInitializing(false);

    // Stop all media tracks to release hardware lights instantly
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn("Failed to stop media tracks:", err);
      }
      mediaStreamRef.current = null;
    }

    // Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (err) {
        console.warn("Failed to abort SpeechRecognition:", err);
      }
      recognitionRef.current = null;
    }

    setInterimTranscript("");
  };

  if (!session && !error) {
    return <LoadingSkeleton title="Loading interview workspace" rows={3} />;
  }

return (
    <div className="interview-workspace min-h-screen overflow-y-auto flex flex-col font-body relative">
      {/* Absolute background grid system */}
      <div className="absolute inset-0 grid-pattern-overlay opacity-20 pointer-events-none z-0" />

      {/* Top Header Bar */}
      <nav className="relative z-40 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <NavLink
            to="/dashboard"
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors"
            title="Back to cockpit dashboard"
          >
            <ArrowLeft size={16} />
          </NavLink>
          <div>
            <h1 className="text-lg font-black text-white font-heading tracking-tight leading-none">Interview Workspace</h1>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
              {session?.interviewType || "Practice"} Round &middot; {session?.templateType || "Technical"} round
            </p>
          </div>
        </div>

        {/* Workspace controls */}
        <div className="flex flex-wrap items-center gap-2">
          <NavLink
            to={`/interview/session/${sessionId}/coding`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border border-white/10 bg-white/5 text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 transition-all shadow-md shrink-0"
          >
            <Code2 size={14} className="text-emerald-400" />
            <span>Coding Round</span>
          </NavLink>
          
          <button
            onClick={() => {
              setMode("chat");
              setSpeechError("");
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all shadow-md ${
              mode === "chat" 
                ? "bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 border-emerald-400/20" 
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Chat Interview</span>
            <span className="sm:hidden">Chat</span>
          </button>
          
          <button
            onClick={() => {
              setMode("voice");
              setSpeechError("");
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all shadow-md ${
              mode === "voice" 
                ? "bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 border-emerald-400/20" 
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            <Mic size={14} />
            <span className="hidden sm:inline">Voice Interview</span>
            <span className="sm:hidden">Voice</span>
          </button>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="relative z-10 max-w-[1500px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col">
        {/* Error Callout */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-400 flex items-start justify-between gap-3 animate-fade-up">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-red-400">Session Workspace Exception</p>
                <p className="mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <button 
              onClick={() => setError("")} 
              className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/5 shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Progress Tracker Summary */}
        <div className="mb-5 animate-fade-up">
          <ProgressSummary elapsed={elapsed} stats={stats} />
        </div>

        {/* Locked Completed Status Block */}
        {isCompleted && (
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed text-emerald-300 flex items-center gap-3 animate-fade-up select-none">
            <Trophy size={18} className="text-emerald-400 animate-glow-pulse shrink-0" />
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-white leading-tight">Interview Completed &middot; Scorecard Finalized</p>
              <p className="mt-1 font-semibold text-slate-400">Mock responses, ratings, voice settings, and follow-ups are officially saved and locked.</p>
            </div>
          </div>
        )}

        {/* Tablet/Mobile Responsive Tab Switches (hidden on large displays) */}
        <div className="flex border border-white/5 bg-slate-900/60 p-1.5 rounded-2xl mb-5 xl:hidden select-none shadow-md">
          {[
            { id: "question", label: "Question prompt" },
            { id: "interview", label: "Mock workspace" },
            { id: "evaluation", label: "AI feedback" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3-Column Cockpit grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 flex-1 min-h-[600px] h-full">
          {/* Question Left Pane */}
          <aside className={`xl:col-span-3 space-y-5 xl:h-full xl:overflow-y-auto premium-scrollbar pb-6 xl:block ${activeTab === "question" ? "block animate-fade-up" : "hidden"}`}>
            <InterviewQuestionCard question={currentQuestion} latestQuestionMeta={latestQuestionMeta} />
          </aside>

          {/* Core Dialogue Pane */}
          <section className={`xl:col-span-6 flex flex-col xl:h-full xl:overflow-y-auto premium-scrollbar gap-5 ${activeTab === "interview" ? "flex flex-col animate-fade-up" : "hidden"}`}>
            <div className="shrink-0">
              <InterviewControls
                mode={mode}
                answer={answer}
                difficulty={difficulty}
                loadingAction={loadingAction}
                isCompleted={isCompleted}
                canSubmit={Boolean(answer.trim()) && Boolean(currentQuestion) && !hasSubmittedCurrentQuestion}
                disabled={isCompleted || hasSubmittedCurrentQuestion}
                canGenerateFollowUp={Boolean(currentQuestion && latestEvaluation)}
                canGenerateScorecard={transcript.length > 0}
                onAnswerChange={setAnswer}
                onDifficultyChange={setDifficulty}
                onGenerateQuestion={handleGenerateQuestion}
                onSubmitAnswer={handleSubmitAnswer}
                onGenerateFollowUp={handleGenerateFollowUp}
                onGenerateScorecard={() => setConfirmEndOpen(true)}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isInitializing={isInitializing}
                isMicActive={isMicActive}
                speechVolume={speechVolume}
                onSpeechVolumeChange={setSpeechVolume}
                speechError={speechError}
                onClearSpeechError={() => setSpeechError("")}
                interimTranscript={interimTranscript}
                recognitionSupported={recognitionSupported}
                synthesisSupported={synthesisSupported}
                voices={voices}
                selectedVoiceURI={selectedVoiceURI}
                speechRate={speechRate}
                speechPitch={speechPitch}
                currentQuestionText={latestQuestionMeta?.question || currentQuestion?.message || ""}
                onStartListening={startListening}
                onStopListening={stopListening}
                onPlayQuestion={() => speakQuestion(latestQuestionMeta?.question || currentQuestion?.message || "")}
                onStopSpeaking={stopSpeaking}
                onSelectedVoiceChange={setSelectedVoiceURI}
                onSpeechRateChange={setSpeechRate}
                onSpeechPitchChange={setSpeechPitch}
              />
            </div>
            <div className="shrink-0 pb-6 mt-4">
              <InterviewTranscript transcript={transcript} compact />
            </div>
          </section>

          {/* AI Scorecard & Statistics Right Pane */}
          <aside className={`xl:col-span-3 space-y-5 xl:h-full xl:overflow-y-auto premium-scrollbar pb-6 xl:block ${activeTab === "evaluation" ? "block animate-fade-up" : "hidden"}`}>
            <InterviewEvaluationCard evaluation={latestEvaluation} scorecard={scorecard} />

            {/* Structured Stats Tile */}
            <section className="premium-card overflow-hidden bg-slate-900/60 shadow-xl border border-white/8">
              <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-white font-heading tracking-tight">Session Details</h2>
                  <p className="text-xs text-slate-400 mt-1">Mock engine progress parameters</p>
                </div>
                <Clock size={16} className="text-emerald-400 animate-glow-pulse" />
              </div>
              
              <div className="p-5 grid grid-cols-2 gap-3">
                <StatTile label="Questions" value={stats.questionCount} />
                <StatTile label="Answers" value={stats.answerCount} />
                <StatTile label="Follow-Ups" value={stats.followUpCount} />
                <StatTile label="Elapsed Time" value={formatElapsed(elapsed)} />
                <StatTile label="Session Status" value={session?.status || "draft"} />
                <StatTile label="Round Type" value={session?.templateType || "technical"} />
              </div>
            </section>

            {/* Quick Stats Panel */}
            <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <RotateCcw size={14} className="text-emerald-400" />
                <span>Round Metadata Configurations</span>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Evaluations Saved</span>
                  <span className="font-extrabold text-white">{stats.evaluationCount}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Dialog Input Mode</span>
                  <span className="font-extrabold text-white capitalize">{mode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tier Difficulty</span>
                  <span className="font-extrabold text-white capitalize">{difficulty}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* Confirmation modal trigger */}
      <ConfirmationDialog
        open={confirmEndOpen}
        title="Generate final interview scorecard?"
        description="This will lock all response triggers, generate strengths/weaknesses logs, and evaluate your placement-readiness score."
        confirmText="Confirm End Round"
        onCancel={() => setConfirmEndOpen(false)}
        onConfirm={() => {
          setConfirmEndOpen(false);
          handleGenerateScorecard();
        }}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default InterviewWorkspace;
