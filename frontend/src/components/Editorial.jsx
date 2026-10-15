/**
 * @file Editorial.jsx
 * @summary Custom video explanation player player utilizing HTML5 video tagging.
 *          Implements responsive play/pause buttons, metadata loaders, seek bars, hover state tracking,
 *          and global spacebar keyboard listeners to control play states.
 * 
 * @functions
 * - Editorial: Core player component managing loading flags, active play/pause timelines, and event triggers.
 * - formatTime: Helper utility that parses elapsed video playback seconds into a "min:sec" string format.
 * - togglePlayPause: Accesses the HTML5 video element ref to trigger play/pause actions.
 * - useEffect (playback events): Subscribes to HTML5 video `timeupdate` and `loadedmetadata` events to sync progress.
 * - useEffect (keyboard hooks): Attaches a keydown listener to the global window object to support Spacebar controls.
 */

import React, { useState, useRef, useEffect } from "react";
import { Pause, Play, VideoOff } from "lucide-react";

const Editorial = ({ secureUrl, thumbnailUrl, duration }) => {
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ================= SAFE GUARD =================
  if (!secureUrl) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-2xl border border-white/5 bg-slate-900/60 p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center justify-center animate-fade-up">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-950 border border-white/5 text-slate-500 mb-4">
          <VideoOff size={22} />
        </div>

        <h3 className="text-sm sm:text-base font-black text-white font-heading">
          No Video Editorial Available
        </h3>

        <p className="mt-2 text-xs sm:text-sm text-slate-400 font-semibold leading-relaxed max-w-sm">
          The problem setter has not published a step-by-step video explanation for this task yet.
        </p>
      </div>
    );
  }

  // ================= FORMAT TIME =================
  const formatTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // ================= PLAY / PAUSE =================
  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (err) {
      console.log("Playback blocked:", err);
    }
  };

  // ================= EVENTS =================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);

    const handleLoaded = () => {
      setVideoDuration(video.duration);
      setIsLoading(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoaded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, []);

  // ================= KEYBOARD SUPPORT =================
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ================= UI =================
  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl transition-all duration-300"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        src={secureUrl}
        poster={thumbnailUrl}
        onClick={togglePlayPause}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full aspect-video bg-black cursor-pointer object-contain"
      />

      {/* LOADING */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10">
          <span className="loading loading-spinner loading-md text-emerald-400"></span>
        </div>
      )}

      {/* CENTER PLAY BUTTON */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center text-white bg-slate-950/30 hover:bg-slate-950/40 hover:scale-105 active:scale-95 transition-all z-10 cursor-pointer"
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(52,211,153,0.3)] border border-emerald-300">
            <Play size={24} className="fill-current ml-1" />
          </div>
        </button>
      )}

      {/* CONTROLS */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4.5 transition-opacity duration-300 z-20 ${isHovering || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlayPause}
            className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-slate-950 hover:opacity-90 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer"
          >
            {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
          </button>

          <span className="text-white text-xs font-mono shrink-0">
            {formatTime(currentTime)}
          </span>

          {/* SEEK BAR */}
          <input
            type="range"
            min="0"
            max={videoDuration || 100}
            value={currentTime}
            onChange={(e) => {
              const newTime = Number(e.target.value);
              videoRef.current.currentTime = newTime;
              setCurrentTime(newTime);
            }}
            className="range range-xs select-emerald bg-white/10 accent-emerald-400 flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
          />

          <span className="text-white text-xs font-mono shrink-0">
            {formatTime(videoDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Editorial;
