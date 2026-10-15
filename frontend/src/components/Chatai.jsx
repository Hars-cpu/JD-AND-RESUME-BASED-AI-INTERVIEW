/**
 * @file Chatai.jsx
 * @summary React component for the AI Coding Mentor chat panel. It supports text conversation, markdown rendering of replies,
 *          and browser speech-to-text dictation (Web Speech API) while passing the user's active code context to the AI.
 * 
 * @functions
 * - ChatAi: Primary functional component that manages message states, auto-scrolling, text area height, and child rendering.
 * - startSpeechInput: Instantiates and starts the browser's `SpeechRecognition` service, appending transcripts to the input area.
 * - stopSpeechInput: Safely aborts or stops speech dictation.
 * - onSubmit: Sends conversation history, active code, start code, language, and problem metadata to the backend API (`/ai/chat`).
 */

import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { AlertCircle, Bot, Mic, Send, Sparkles, Square, User } from "lucide-react";
import axiosClient from "../utils/axiosClient";
import MarkdownRenderer from "./MarkdownRenderer";

function ChatAi({ problem, activeCode, startCode, language, submissionStatus }) {
  const { user } = useSelector((state) => state.auth);
  const [messages, setMessages] = useState([
    {
      role: "model",
      parts: [
        {
          text: "Hi! I am your ALGOPILOT AI Coding Mentor. Need help figuring out the logic, optimizing complexity, or debugging your code for this problem?"
        }
      ],
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const { register, handleSubmit, reset, setValue, getValues } = useForm();
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const recognitionSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
  }, []);

  const startSpeechInput = () => {
    if (!recognitionSupported) {
      setSpeechError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isListening) return;

    try {
      recognitionRef.current?.abort?.();
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      finalTranscriptRef.current = getValues("message") || "";
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setSpeechError("");
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interimText = "";
        let finalText = "";

        for (let index = event.resultIndex; index < event.results.length; index++) {
          const transcriptText = event.results[index][0]?.transcript || "";
          if (event.results[index].isFinal) finalText += transcriptText;
          else interimText += transcriptText;
        }

        if (finalText.trim()) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.trim();
        }

        const nextValue = `${finalTranscriptRef.current} ${interimText}`.trim();
        setValue("message", nextValue, { shouldDirty: true, shouldValidate: true });
      };

      recognition.onerror = (event) => {
        const errorMessages = {
          "not-allowed": "Microphone permission was denied. Please allow microphone access.",
          "service-not-allowed": "Speech recognition is blocked in this browser.",
          "no-speech": "No speech was detected. Please try again.",
          network: "Speech recognition could not connect. Check your internet connection.",
          "audio-capture": "No microphone was found."
        };
        if (event.error !== "aborted") {
          setSpeechError(errorMessages[event.error] || "Speech recognition failed. Please try again.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechError("Unable to start speech recognition in this browser.");
    }
  };

  const stopSpeechInput = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      recognitionRef.current?.abort?.();
    } finally {
      setIsListening(false);
    }
  };

  const onSubmit = async (data) => {
    const userText = data.message.trim();
    if (!userText) {
      console.warn("Empty message submitted");
      return;
    }

    const newUserMsg = {
      role: "user",
      parts: [{ text: userText }],
      timestamp: new Date()
    };
    const updatedMessages = [...messages, newUserMsg];

    setMessages(updatedMessages);
    reset();
    setIsLoading(true);

    try {
      // Validate problem and activeCode before sending
      if (!problem || !problem.title) {
        throw new Error("Problem context is missing");
      }

      const aiPayload = {
        messages: updatedMessages,
        title: problem.title || "",
        description: problem.description || "",
        constraints: problem.constraints || "",
        testCases: problem.visibleTestCases || [],
        startCode: startCode || "",
        activeCode: activeCode || "",
        language: language || "javascript",
        submissionStatus: submissionStatus || null
      };

      console.info("[AI Doubt Solver Payload]", aiPayload);

      const response = await axiosClient.post("/ai/chat", aiPayload);

      // Validate response structure
      if (!response.data || !response.data.message) {
        throw new Error("Invalid response from server");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          parts: [{ text: response.data.message }],
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      console.error("API Error:", error);

      // Determine error message based on error type
      let errorMessage = "Sorry, I am currently experiencing connection issues. Please check your API usage or try again later.";

      if (error.response?.status === 401) {
        errorMessage = "You need to be logged in to use this feature.";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid request. Please check your input and try again.";
      } else if (error.message === "Network Error") {
        errorMessage = "Network connection failed. Please check your connection and try again.";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          parts: [{ text: errorMessage }],
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/60 relative rounded-2xl border border-white/5 overflow-hidden backdrop-blur-md">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 premium-scrollbar">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const timeString = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={index}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-fade-up`}
            >
              <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full group gap-2.5`}>
                {!isUser && (
                  <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all hover:scale-105 duration-300 select-none">
                    <Bot size={16} className="animate-pulse" />
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl opacity-10 blur-sm -z-10 group-hover:opacity-30 transition-opacity"></div>
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg transition-all duration-300 ${isUser
                      ? "bg-slate-900 border border-emerald-500/20 text-emerald-100 rounded-tr-none shadow-emerald-950/20"
                      : "bg-[#0B132B]/75 text-slate-100 border border-white/5 rounded-tl-none shadow-slate-950/40"
                    }`}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap font-semibold tracking-wide leading-relaxed">{msg.parts[0].text}</div>
                  ) : (
                    <MarkdownRenderer text={msg.parts[0].text} />
                  )}
                </div>

                {isUser && (
                  <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 border border-emerald-400/20 text-slate-950 font-black text-xs shrink-0 mt-0.5 shadow-md select-none transition-all hover:scale-105 duration-300">
                    {user?.firstName?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>

              {/* Message Timestamp */}
              <div className={`text-[9px] font-bold text-slate-500 mt-2.5 select-none tracking-widest transition-opacity duration-300 uppercase ${isUser ? "mr-12" : "ml-12"
                }`}>
                {timeString}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start items-start animate-fade-up gap-2.5">
            <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Bot size={16} className="animate-pulse" />
            </div>
            <div className="bg-[#0B132B]/75 border border-white/5 text-slate-300 rounded-2xl rounded-tl-none px-4.5 py-3 flex items-center gap-3.5 shadow-lg shadow-slate-950/40 select-none">
              <div className="flex items-center gap-1.5 h-3">
                <span className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-slate-950/60 border-t border-white/5 shrink-0">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-end gap-2.5 bg-slate-900/80 border border-white/10 rounded-xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-transparent transition-all shadow-inner"
        >
          <textarea
            placeholder="Ask AI coding mentor for hints, code review, or complexity analysis..."
            className="flex-1 bg-transparent text-slate-200 text-xs sm:text-sm resize-none outline-none py-2 px-2.5 min-h-[38px] max-h-[100px] placeholder-slate-500 font-semibold leading-relaxed"
            rows={1}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(onSubmit)();
              }
            }}
            {...register("message", { required: true, minLength: 2 })}
          />
          <button
            type="button"
            onClick={isListening ? stopSpeechInput : startSpeechInput}
            disabled={isLoading || !recognitionSupported}
            title={recognitionSupported ? (isListening ? "Stop dictation" : "Dictate message") : "Speech recognition is not supported"}
            className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center active:scale-95 hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed mb-0.5 ${isListening
                ? "bg-red-500 text-white shadow-md shadow-red-500/10"
                : "bg-slate-800 text-slate-300 border border-white/10 hover:text-emerald-300"
              }`}
          >
            {isListening ? <Square size={13} className="fill-current" /> : <Mic size={14} />}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 flex items-center justify-center hover:opacity-90 active:scale-95 hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed mb-0.5 shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            <Send size={14} className="stroke-[2.5]" />
          </button>
        </form>
        {speechError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] font-semibold text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{speechError}</span>
          </div>
        )}
        <div className="text-center mt-2.5 flex items-center justify-center gap-1.5 text-slate-500">
          <Sparkles size={11} className="text-emerald-400" />
          <span className="text-[10px] font-semibold">AI can make mistakes. Verify important solutions.</span>
        </div>
      </div>
    </div>
  );
}

export default ChatAi;
