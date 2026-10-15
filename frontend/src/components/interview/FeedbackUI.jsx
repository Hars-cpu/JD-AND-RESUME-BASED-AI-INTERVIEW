/**
 * @file FeedbackUI.jsx
 * @summary Unified feedback components library for the mock interview platform. 
 *          Exposes standard visual states for loaders, placeholder screens, error prompts, 
 *          toasts, and interactive overlays.
 * 
 * @functions
 * - LoadingSkeleton: Skeleton block layout mimicking a loaded page structure with animated pulse highlights.
 * - InlineSpinner: Centered, animated fullscreen spinner for blocking fetch states.
 * - EmptyState: Descriptive card panel with helper icons and actions for zero-data screens.
 * - ErrorState: Warning card panel showing system messages and a retry button trigger.
 * - Toast: Auto-dismissing success/notification popup that slides in and cleans up timers on close.
 * - ConfirmationDialog: Dialog overlay forcing choice selection (confirm/cancel options) with custom focus colors.
 */

import React, { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

function LoadingSkeleton({ title = "Loading", rows = 3 }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-body p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-5 animate-pulse" aria-label={title}>
        <div className="h-16 rounded-2xl bg-white/5 border border-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-white/5 border border-white/5" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-44 rounded-2xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  );
}

function InlineSpinner({ label = "Loading" }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3.5" role="status" aria-live="polite">
      <Loader2 className="animate-spin text-emerald-400" size={32} />
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
    </div>
  );
}

function EmptyState({ title, description, icon: Icon = Info, action }) {
  return (
    <section className="premium-card p-8 text-center bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-white/8 shadow-xl flex flex-col items-center justify-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-md">
        <Icon size={20} />
      </div>
      <h2 className="mt-4 text-base font-black text-white font-heading">{title}</h2>
      {description && <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed font-semibold">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <section className="premium-card p-6 bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-white/8 border-l-4 border-l-rose-500 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-md">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white font-heading">{title}</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 font-semibold leading-relaxed">
              {message || "Please check your network and attempt the operation again."}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="premium-button text-xs py-2 px-4 shadow-lg shrink-0 cursor-pointer"
          >
            Try Again
          </button>
        )}
      </div>
    </section>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-2xl border border-emerald-500/20 bg-slate-900 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.6)] animate-fade-up" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md mt-0.5">
          <CheckCircle2 size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-black text-white font-heading leading-tight">{toast.title || "Success"}</p>
          {toast.message && <p className="mt-1 text-xs text-slate-400 font-semibold leading-relaxed">{toast.message}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss notification"
          className="text-slate-500 hover:text-white hover:bg-white/5 transition-all p-1.5 rounded-lg focus:outline-none cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ConfirmationDialog({ open, title, description, confirmText = "Confirm", tone = "dark", onConfirm, onCancel }) {
  if (!open) return null;

  const confirmClass = tone === "danger"
    ? "bg-rose-600 hover:bg-rose-500 border border-rose-500/20 text-slate-950 font-black shadow-rose-600/10 shadow-md"
    : "premium-button text-xs py-2 px-4 shadow-md";

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 animate-fade-up">
        <h2 id="confirmation-title" className="text-base sm:text-lg font-black text-white font-heading">{title}</h2>
        {description && <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400 font-semibold">{description}</p>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="ghost-button px-4 py-2 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  InlineSpinner,
  LoadingSkeleton,
  Toast
};
