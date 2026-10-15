/**
 * @file AppShell.jsx
 * @summary Master layout wrapper component providing structural layout grids, decorative background patterns, 
 *          responsive sidebar navigations (collapsible for desktop, drawer-toggle for mobile), 
 *          user profile summary chips, logout workflows, and title action headers.
 * 
 * @functions
 * - getProfileUsername: Resolves a clean username slug based on user email prefix or name attributes.
 * - Brand: Renders the brand logo and application heading linked to the homepage.
 * - NavItem: Displays a single navigation link with active state detection, hover tooltips, and matching routing indicators.
 * - AppShell: Main functional layout component that reads auth user profiles, stores sidebar collapse preferences in localStorage,
 *             handles side drawers, and manages page structure wrappers.
 */

import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import {
  Award,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Code2,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Trophy,
  User,
  Shield,
  X
} from "lucide-react";
import { logoutUser } from "../../authSlice";

const getProfileUsername = (user) => {
  const emailPrefix = user?.emailId?.split("@")?.[0];
  const nameFallback = [user?.firstName, user?.lastName].filter(Boolean).join("-");
  return String(emailPrefix || nameFallback || "me")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
};

const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/problems", label: "Problems", icon: Code2 },
  { to: "/interview/start", label: "Interviews", icon: BrainCircuit },
  { to: "/interview/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/interview/roadmap", label: "Learning Roadmap", icon: BookOpen },
  { to: "/interview/preparation-hub", label: "Preparation Hub", icon: Trophy },
  { to: "/interview/achievements", label: "Achievements", icon: Award }
];

function Brand({ collapsed = false }) {
  return (
    <NavLink to="/dashboard" className={`flex items-center gap-3 group ${collapsed ? "justify-center" : ""}`}>
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.18)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
        <img src="/logo.png" alt="ALGOPILOT Logo" className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      </div>
      {!collapsed && (
      <div>
        <p className="text-base font-black tracking-tight text-white font-heading">
          ALGOPILOT
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">Career cockpit</p>
      </div>
      )}
    </NavLink>
  );
}

function NavItem({ item, onClick, collapsed = false }) {
  const location = useLocation();
  const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 ${
        collapsed ? "justify-center px-3" : ""
      } ${
        active
          ? "bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.06)]"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r bg-emerald-400 shadow-[0_0_8px_#34d399]" />
      )}
      <Icon
        size={18}
        className={`transition-colors duration-300 ${
          active ? "text-emerald-400" : "text-slate-500 group-hover:text-emerald-400"
        }`}
      />
      {!collapsed && <span>{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </NavLink>
  );
}

function AppShell({ children, title, subtitle, actions }) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("algopilot-sidebar-collapsed") === "true";
  });
  const profilePath = `/profile/${getProfileUsername(user)}`;

  const closeMobile = () => setMobileOpen(false);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("algopilot-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {/* Decorative layout gradients and grid background overlays */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_40%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.06),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)]" />
        <div className="absolute inset-0 grid-pattern-overlay opacity-30" />
      </div>

      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-white/10 bg-slate-950/80 p-5 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col overflow-y-auto premium-scrollbar ${collapsed ? "w-24" : "w-72"}`}>
        <div className="absolute inset-0 grid-pattern-overlay opacity-10 pointer-events-none" />
        <div className={`relative z-10 flex gap-3 ${collapsed ? "flex-col items-center" : "items-center justify-between"}`}>
          <Brand collapsed={collapsed} />
          <button
            onClick={toggleCollapsed}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        <nav className="mt-8 space-y-1.5 relative z-10">
          {mainNav.map((item) => (
            <NavItem key={`${item.label}-${item.to}`} item={item} collapsed={collapsed} />
          ))}
          {user?.role === "admin" && (
            <NavItem item={{ to: "/admin", label: "Admin", icon: Shield }} collapsed={collapsed} />
          )}
          <NavItem item={{ to: profilePath, label: "Profile", icon: User }} collapsed={collapsed} />
        </nav>

        {/* User Card */}
        <div className="mt-auto pt-6 border-t border-white/5 relative z-10">
          {collapsed ? (
            <button
              onClick={async () => {
                await dispatch(logoutUser());
                navigate("/login");
              }}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-black text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                {user?.firstName?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white leading-tight">
                  {user?.firstName || "User"} {user?.lastName || ""}
                </p>
                <p className="truncate text-xs text-slate-500 mt-0.5">
                  {user?.emailId || "Member"}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                await dispatch(logoutUser());
                navigate("/login");
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors duration-200"
            >
              <LogOut size={13} className="text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors duration-200"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile Drawer (Left Slide-in Side Drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop blur overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={closeMobile}
            aria-label="Close menu backdrop"
          />
          <aside className="relative h-full w-[80vw] max-w-xs border-r border-white/10 bg-slate-950 p-5 shadow-2xl flex flex-col justify-between animate-fade-up">
            <div className="absolute inset-0 grid-pattern-overlay opacity-15 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <Brand />
                <button
                  onClick={closeMobile}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors duration-200"
                  aria-label="Close navigation panel"
                >
                  <X size={19} />
                </button>
              </div>
              <nav className="mt-8 space-y-1.5">
                {mainNav.map((item) => (
                  <NavItem key={`${item.label}-${item.to}`} item={item} onClick={closeMobile} />
                ))}
                {user?.role === "admin" && (
                  <NavItem item={{ to: "/admin", label: "Admin Panel", icon: Shield }} onClick={closeMobile} />
                )}
                <NavItem item={{ to: profilePath, label: "My Profile", icon: User }} onClick={closeMobile} />
              </nav>
            </div>

            <div className="relative z-10 pt-6 border-t border-white/5">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-black text-slate-950">
                    {user?.firstName?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {user?.firstName || "User"} {user?.lastName || ""}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user?.emailId || "Member"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await dispatch(logoutUser());
                    closeMobile();
                    navigate("/login");
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors duration-200"
                >
                  <LogOut size={13} className="text-slate-400" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Page Workspace */}
      <main className={`relative z-10 flex min-h-screen flex-col transition-all duration-300 ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <div className="flex-1 mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          {(title || subtitle || actions) && (
            <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/8 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl sm:flex-row sm:items-center sm:justify-between animate-fade-up">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1 text-xs font-extrabold text-emerald-300">
                  <Trophy size={13} />
                  <span>ALGOPILOT Workspace</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-heading">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2.5 max-w-4xl text-sm leading-relaxed text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap gap-2 shrink-0 sm:self-end">
                  {actions}
                </div>
              )}
            </div>
          )}
          <div className="animate-fade-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AppShell;


