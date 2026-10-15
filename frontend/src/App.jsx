/**
 * @file App.jsx
 * @description Main entry point for the ALGOPILOT frontend application.
 * Defines the routing hierarchy, configures authentication verification,
 * and guards protected routes (both User and Admin-only spaces).
 */

import React, { useEffect } from "react";
import { Routes, Route, Navigate, useParams, NavLink } from "react-router";
import { Code2 } from "lucide-react";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { checkAuth } from "./authSlice";
import { useDispatch, useSelector } from "react-redux";
import AdminPanel from "./components/AdminPanel";
import ProblemPage from "./pages/ProblemPage";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminDelete from "./components/AdminDelete";
import AdminUpload from "./components/AdminUpload";
import AdminUpdate from "./components/AdminUpdate";
import AdminVideo from "./components/AdminVideo";
import InterviewWorkspace from "./pages/interview/InterviewWorkspace";
import CodingInterviewWorkspace from "./pages/interview/CodingInterviewWorkspace";
import InterviewAnalyticsDashboard from "./pages/interview/InterviewAnalyticsDashboard";
import InterviewStart from "./pages/interview/InterviewStart";
import LearningRoadmap from "./pages/interview/LearningRoadmap";
import InterviewPreparationHub from "./pages/interview/InterviewPreparationHub";
import AchievementsPage from "./pages/interview/AchievementsPage";
import PublicProfile from "./pages/interview/PublicProfile";
import ErrorBoundary from "./components/interview/ErrorBoundary";

/**
 * RedirectProblem Component
 * Handles legacy routing compatibility by redirecting requests from
 * '/problem/:problemId' to the updated path '/problems/:problemId'.
 */
function RedirectProblem() {
  const { problemId } = useParams();
  return <Navigate to={`/problems/${problemId}`} replace />;
}

/**
 * NotFound Component
 * Renders a premium, branded 404 error page when a user attempts
 * to navigate to a route that does not exist in the routing table.
 */
function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#020617] text-white p-6 text-center">
      <h1 className="text-7xl font-black text-[#4A9B6F] mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-8 max-w-md font-body">
        The page you are looking for does not exist, has been removed, or is temporarily unavailable.
      </p>
      <NavLink to="/" className="premium-button px-6 py-3 text-sm font-semibold no-underline">
        Go Back Home
      </NavLink>
    </div>
  );
}

/**
 * Main App Component
 * Manages core authentication initialization on mount and renders
 * the layout and Routing table inside an ErrorBoundary.
 */
function App() {
  // Fetch authentication status, loading state, and user details from Redux store
  const { isAuthenticated, loading, user } = useSelector(
    (state) => state.auth
  );
  const dispatch = useDispatch();

  // Verify user's session token with backend on initial component mount
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  // ⏳ Branded Loading screen
  if (loading) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
        {/* Subtle grid background overlay */}
        <div className="absolute inset-0 grid-pattern-overlay opacity-30 pointer-events-none" />
        
        {/* Glowing backgrounds */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative flex flex-col items-center z-10 animate-fade-up">
        {/* Centered ALGOPILOT logomark */}
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.25)] animate-glow-pulse">
            <img src="/logo.png" alt="ALGOPILOT Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
          
          <h1 className="mt-6 text-3xl font-black tracking-tight font-heading">
            ALGOPILOT
          </h1>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-300/80">
            Master DSA. Crack Interviews.
          </p>
          
          {/* Subtitle & Loading indicators */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm font-semibold tracking-wide text-slate-400">
              Loading your workspace
            </p>
            <span className="loading loading-dots loading-sm text-emerald-400"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <Routes>
      {/* Default Route */}
      <Route
        path="/"
        element={
          <Navigate
            to={isAuthenticated ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      {/* Auth Routes: Only accessible when NOT logged in. Authenticated users are redirected to /dashboard */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        }
      />
      <Route
        path="/signup"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />
        }
      />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/profile/:username" element={<PublicProfile />} />

      {/* Protected User Routes: Require isAuthenticated to be true. Redirects to /login if unauthenticated */}
      <Route
        path="/problems"
        element={
          isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/problems/:problemId"
        element={
          isAuthenticated ? <ProblemPage /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/problems/:problemId/review"
        element={
          isAuthenticated ? <ProblemPage /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/session/:sessionId"
        element={
          isAuthenticated ? <InterviewWorkspace /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/start"
        element={
          isAuthenticated ? <InterviewStart /> : <Navigate to="/login" replace />
        }
      />
      <Route path="/interview" element={<Navigate to="/interview/start" replace />} />
      <Route
        path="/interview/session/:sessionId/coding"
        element={
          isAuthenticated ? <CodingInterviewWorkspace /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/analytics"
        element={
          isAuthenticated ? <InterviewAnalyticsDashboard /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/roadmap"
        element={
          isAuthenticated ? <LearningRoadmap /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/preparation-hub"
        element={
          isAuthenticated ? <InterviewPreparationHub /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/interview/achievements"
        element={
          isAuthenticated ? <AchievementsPage /> : <Navigate to="/login" replace />
        }
      />

      {/* Admin-Only Routes: Require both isAuthenticated and user.role === 'admin'. Redirects to /login if unauthorized */}
      <Route
        path="/admin"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <Admin />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/problems/create"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <AdminPanel />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/admin/create" element={<Navigate to="/admin/problems/create" replace />} />
      <Route
        path="/admin/delete"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <AdminDelete />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/video"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <AdminVideo />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/problems/:id/edit"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <AdminUpdate />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/upload/:problemId"
        element={
          isAuthenticated && user?.role === "admin" ? (
            <AdminUpload />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Fix old route */}
      <Route path="/problem/:problemId" element={<RedirectProblem />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </ErrorBoundary>
  );
}

export default App;
