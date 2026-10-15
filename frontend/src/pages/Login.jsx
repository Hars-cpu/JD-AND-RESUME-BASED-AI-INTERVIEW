/**
 * @file Login.jsx
 * @description Sign-in page for ALGOPILOT. Uses react-hook-form combined with
 * Zod for client-side form validation. Manages redirection for already authenticated users.
 */

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router";
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { loginUser } from "../authSlice";
import AuthBrandPanel, { AuthLogo } from "../components/auth/AuthBrandPanel";

// Validation schema for login credentials using Zod
const loginSchema = z.object({
  emailId: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

/**
 * Login Component
 * Manages form submission, password visibility toggles, and handles
 * redirect logic if user details are already validated in store.
 */
function Login() {
  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Select slice variables from global auth state
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  // Set up React Hook Form with Zod validation schema resolver
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ resolver: zodResolver(loginSchema) });

  // Automatically redirect user to dashboard if they are already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  // Dispatch auth thunk when submitting form credentials
  const onSubmit = (data) => {
    dispatch(loginUser(data));
  };

  return (
    <main className="flex min-h-screen bg-slate-950 text-slate-100 font-body antialiased">
      <AuthBrandPanel />

      <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:w-1/2">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.10),transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
        <div className="absolute inset-0 grid-pattern-overlay opacity-25" />

        <div className="relative z-10 w-full max-w-md animate-fade-up">
          <div className="mb-8 flex justify-center lg:hidden">
            <AuthLogo compact />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                <Sparkles size={13} />
                Welcome back
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading leading-tight">
                Sign in to ALGOPILOT
              </h1>
              <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-300">
                Continue your DSA, interview, analytics, and career-readiness flow.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200" role="alert">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-200">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`premium-input h-12 w-full !pl-10 !pr-4 ${errors.emailId ? "border-rose-400/70 focus:border-rose-400" : ""}`}
                    {...register("emailId")}
                  />
                </div>
                {errors.emailId && <p className="mt-2 text-xs font-bold text-rose-300">{errors.emailId.message}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-200">Password</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={`premium-input h-12 w-full !pl-10 !pr-11 ${errors.password ? "border-rose-400/70 focus:border-rose-400" : ""}`}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-xs font-bold text-rose-300">{errors.password.message}</p>}
              </div>

              <button type="submit" className="premium-button h-12 w-full text-sm" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm" /> : null}
                Sign in
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">New here?</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <NavLink to="/signup" className="ghost-button h-12 w-full text-sm font-black">
              Create your ALGOPILOT account
            </NavLink>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
