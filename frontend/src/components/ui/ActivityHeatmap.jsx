/**
 * @file ActivityHeatmap.jsx
 * @summary GitHub-style annual contribution calendar widget. It takes an array of historical coding submissions
 *          and mock interview activity objects, groups counts by dates, calculates consecutive practice streaks, 
 *          and renders a responsive grid of colored squares denoting activity density.
 * 
 * @functions
 * - toDateKey: Resolves Date parameters into normalized "YYYY-MM-DD" key formats.
 * - buildDays: Fills in a 365-day array ending today with counts aggregated from historical activity arrays.
 * - intensityClass: Maps numeric activity counts to styled color intensities (green/emerald variants).
 * - calculateStreak: Checks activity records to find current consecutive login practice streak records.
 * - ActivityHeatmap: Main component rendering the vertical weekdays tags, monthly timeline header labels, 
 *                    interactive contribution grid, and streak description footer.
 */

import React, { useMemo } from "react";
import { Flame, Calendar, Award } from "lucide-react";

const toDateKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

const buildDays = (activity = []) => {
  const counts = activity.reduce((acc, item) => {
    const key = toDateKey(item.date || item.createdAt || item.updatedAt || item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + Number(item.count || 1);
    return acc;
  }, {});

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 364);

  return Array.from({ length: 365 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = toDateKey(day);
    const count = counts[key] || 0;
    return { key, date: day, count };
  });
};

const intensityClass = (count) => {
  if (count <= 0) return "bg-slate-900 border-white/5";
  if (count === 1) return "bg-emerald-950/80 border-emerald-900/40 text-emerald-400";
  if (count <= 3) return "bg-emerald-800 border-emerald-700/50";
  if (count <= 5) return "bg-emerald-600 border-emerald-500/50";
  return "bg-emerald-400 border-emerald-300/80 shadow-[0_0_8px_rgba(52,211,153,0.3)]";
};

const calculateStreak = (activity) => {
  const dates = new Set(
    activity.map(item => toDateKey(item.date || item.createdAt || item.updatedAt || item)).filter(Boolean)
  );
  let streak = 0;
  const checkDate = new Date();
  
  // check if active today or yesterday (to allow streak to not reset if user hasn't coded yet today)
  const activeToday = dates.has(toDateKey(checkDate));
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const activeYesterday = dates.has(toDateKey(yesterday));
  
  if (!activeToday && !activeYesterday) {
    return 0;
  }
  
  let currentCheck = new Date();
  if (!activeToday && activeYesterday) {
    currentCheck.setDate(currentCheck.getDate() - 1);
  }
  
  while (dates.has(toDateKey(currentCheck))) {
    streak++;
    currentCheck.setDate(currentCheck.getDate() - 1);
  }
  return streak;
};

function ActivityHeatmap({ activity = [], title = "Activity Heatmap", subtitle = "Your coding and interview session performance over the last year" }) {
  const days = useMemo(() => buildDays(activity), [activity]);
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const total = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;
  const streak = useMemo(() => calculateStreak(activity), [activity]);

  // Derived month labels aligned to week indices
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0]?.date;
      if (firstDay && firstDay.getMonth() !== lastMonth) {
        labels.push({
          weekIndex,
          label: firstDay.toLocaleString("default", { month: "short" })
        });
        lastMonth = firstDay.getMonth();
      }
    });
    return labels;
  }, [weeks]);

  return (
    <section className="premium-card p-5 sm:p-6 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 font-heading">
            <Calendar size={18} className="text-emerald-400" />
            <span>{title}</span>
          </h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="flex gap-4 text-xs font-bold text-slate-400">
          <span className="premium-badge-green py-0.5 px-2">{total} Activities</span>
          <span className="premium-badge-blue py-0.5 px-2">{activeDays} Active Days</span>
        </div>
      </div>

      <div className="mt-6 flex overflow-x-auto pb-4 premium-scrollbar select-none">
        <div className="flex items-end gap-2.5">
          {/* Day of Week vertical labels */}
          <div className="grid grid-rows-7 gap-1 text-[10px] text-slate-500 font-bold select-none h-[calc(7*10px+6*4px)] sm:h-[calc(7*12px+6*4px)] pb-1 pr-1 border-r border-white/5">
            <span className="h-2.5 sm:h-3"></span>
            <span className="h-2.5 sm:h-3 flex items-center">Mon</span>
            <span className="h-2.5 sm:h-3"></span>
            <span className="h-2.5 sm:h-3 flex items-center">Wed</span>
            <span className="h-2.5 sm:h-3"></span>
            <span className="h-2.5 sm:h-3 flex items-center">Fri</span>
            <span className="h-2.5 sm:h-3"></span>
          </div>

          <div className="flex flex-col">
            {/* Months Row */}
            <div className="h-4 relative mb-1.5 w-[calc(53*10px+52*4px)] sm:w-[calc(53*12px+52*4px)] text-[9px] font-black uppercase tracking-wider text-slate-500">
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={weekIndex}
                  className="absolute"
                  style={{
                    left: `calc(${weekIndex} * (100% / ${weeks.length}))`
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Heatmap Grid */}
            <div className="flex gap-1 sm:gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      title={`${day.date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}: ${day.count} activities`}
                      className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-[2.5px] border transition-all duration-150 hover:scale-125 ${intensityClass(day.count)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
        {/* Streak summary text */}
        <div className="flex items-center gap-2 font-bold">
          <Flame size={15} className={`text-orange-400 ${streak > 0 ? "animate-bounce" : ""}`} />
          <span>
            {activeDays} days active - {total} total submissions -{" "}
            <span className="text-orange-400">{streak}-day current streak</span>
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 select-none font-semibold text-slate-500">
          <span>Less</span>
          {[0, 1, 2, 4, 7].map((count, i) => (
            <span key={i} className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-[2px] border ${intensityClass(count)}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}

export default ActivityHeatmap;
