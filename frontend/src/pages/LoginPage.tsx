import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowLeft, ArrowRight, Mail, Lock, User } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { googleSignIn, registerUser, loginUser, forgotPassword } from "../api";
import { useAuth } from "../context/AuthContext";

type View = "signin" | "register" | "forgot";

export default function LoginPage({ onBack }: { onBack?: () => void }) {
  const { login } = useAuth();
  const [view, setView]               = useState<View>("signin");
  const [showPw, setShowPw]           = useState(false);
  const [showPw2, setShowPw2]         = useState(false);
  const [forgotSent, setForgotSent]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Sign-in refs
  const siEmail = useRef<HTMLInputElement>(null);
  const siPw    = useRef<HTMLInputElement>(null);

  // Register refs
  const rgName  = useRef<HTMLInputElement>(null);
  const rgEmail = useRef<HTMLInputElement>(null);
  const rgPw    = useRef<HTMLInputElement>(null);
  const rgPw2   = useRef<HTMLInputElement>(null);

  // Forgot ref
  const fgEmail = useRef<HTMLInputElement>(null);

  function switchView(v: View) {
    setView(v);
    setError("");
    setShowPw(false);
    setShowPw2(false);
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    setError("");
    setLoading(true);
    try {
      const data = await googleSignIn(credentialResponse.credential);
      login(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message ?? "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const email = siEmail.current?.value.trim() ?? "";
    const pw    = siPw.current?.value ?? "";
    if (!email || !pw) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const data = await loginUser(email, pw);
      login(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message ?? "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name  = rgName.current?.value.trim() ?? "";
    const email = rgEmail.current?.value.trim() ?? "";
    const pw    = rgPw.current?.value ?? "";
    const pw2   = rgPw2.current?.value ?? "";
    if (!name || !email || !pw || !pw2) { setError("Please fill in all fields."); return; }
    if (pw !== pw2) { setError("Passwords do not match."); return; }
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const data = await registerUser(name, email, pw);
      login(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const email = fgEmail.current?.value.trim() ?? "";
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res?.google_account) {
        setError("This account uses Google Sign-In. Please use the \"Sign in with Google\" button instead.");
      } else {
        setForgotSent(true);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const panel = {
    signin:  { heading: "Welcome back",        sub: "Sign in to your account to continue" },
    register:{ heading: "Create your account",  sub: "Join eChannelling — it's free"       },
    forgot:  { heading: "Reset password",       sub: "We'll send a reset link to your email" },
  }[view];

  const inputCls = "w-full py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-800";

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — full image ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/login-bg.png"
          alt="eChannelling"
          className="absolute inset-0 w-full h-full object-cover"
          draggable="false"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#001e5e]/80 via-[#003087]/60 to-[#0069c8]/40" />

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl font-black tracking-tight">eChannelling<span style={{color:"#7dd3fc"}}>AI</span></span>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white leading-tight mb-3">
              Your health,<br />our priority.
            </h1>
            <p className="text-white/70 text-sm leading-relaxed max-w-xs mb-6">
              Sri Lanka's AI-powered medical channelling service. Connect with the right specialist, instantly.
            </p>
            <div className="flex flex-col gap-2">
              {["50+ verified specialists", "Real-time session availability", "AI booking assistant 24/7", "Secure & private"].map(f => (
                <div key={f} className="flex items-center gap-2 text-white/80 text-sm">
                  <div className="w-4 h-4 rounded-full bg-green-400/30 border border-green-400/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-green-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <p className="text-white/40 text-xs mt-8">Powered by <strong className="text-white/60">SLT MOBITEL</strong></p>
          </div>
        </div>
      </div>

      {/* ── RIGHT — auth forms ──────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-white overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-sm font-black text-[#003087]">eChannelling<span style={{color:"#0096D6"}}>AI</span></span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-6">
          <div className="w-full max-w-md">

            {/* Tab switcher */}
            {view !== "forgot" && (
              <div className="flex rounded-xl bg-gray-100 p-1 mb-8">
                {(["signin", "register"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => switchView(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      view === v
                        ? "bg-white text-[#003087] shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {v === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-black text-gray-900 mb-1">{panel.heading}</h2>
                <p className="text-gray-500 text-sm mb-7">{panel.sub}</p>

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Google (sign in + register) */}
                {view !== "forgot" && (
                  <>
                    <div className="flex justify-center mb-5">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google sign-in failed. Please try again.")}
                        theme="outline"
                        size="large"
                        shape="rectangular"
                        text={view === "register" ? "signup_with" : "signin_with"}
                        useOneTap={view === "signin"}
                        width="368"
                      />
                    </div>

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-xs text-gray-400 font-medium">or continue with email</span>
                      </div>
                    </div>
                  </>
                )}

                {/* ── SIGN IN FORM ── */}
                {view === "signin" && (
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={siEmail}
                          type="email" placeholder="you@example.com" autoComplete="email"
                          className={`${inputCls} pl-10 pr-4`}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-gray-700">Password</label>
                        <button type="button" onClick={() => switchView("forgot")} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={siPw}
                          type={showPw ? "text" : "password"} placeholder="••••••••" autoComplete="current-password"
                          className={`${inputCls} pl-10 pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <SubmitBtn loading={loading}>Sign In</SubmitBtn>
                  </form>
                )}

                {/* ── CREATE ACCOUNT FORM ── */}
                {view === "register" && (
                  <form className="space-y-4" onSubmit={handleRegister}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={rgName}
                          type="text" placeholder="John Silva" autoComplete="name"
                          className={`${inputCls} pl-10 pr-4`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={rgEmail}
                          type="email" placeholder="you@example.com" autoComplete="email"
                          className={`${inputCls} pl-10 pr-4`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={rgPw}
                          type={showPw ? "text" : "password"} placeholder="Min. 6 characters" autoComplete="new-password"
                          className={`${inputCls} pl-10 pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={rgPw2}
                          type={showPw2 ? "text" : "password"} placeholder="Re-enter your password" autoComplete="new-password"
                          className={`${inputCls} pl-10 pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw2(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      By creating an account you agree to our{" "}
                      <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{" "}
                      <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
                    </p>
                    <SubmitBtn loading={loading}>Create Account</SubmitBtn>
                  </form>
                )}

                {/* ── FORGOT PASSWORD FORM ── */}
                {view === "forgot" && !forgotSent && (
                  <form className="space-y-4" onSubmit={handleForgot}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={fgEmail}
                          type="email" placeholder="Enter your registered email" autoComplete="email"
                          className={`${inputCls} pl-10 pr-4`}
                        />
                      </div>
                    </div>
                    <SubmitBtn loading={loading}>Send Reset Link</SubmitBtn>
                    <button type="button" onClick={() => switchView("signin")} className="w-full text-center text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium mt-1">
                      ← Back to Sign In
                    </button>
                  </form>
                )}

                {/* ── FORGOT PASSWORD SUCCESS ── */}
                {view === "forgot" && forgotSent && (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Check your email</h3>
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                      If that email is registered, a reset link has been sent. It may take a few minutes to arrive.
                    </p>
                    <button
                      onClick={() => { switchView("signin"); setForgotSent(false); }}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Bottom note */}
            {view !== "forgot" && (
              <p className="text-xs text-center text-gray-400 mt-6">
                {view === "signin"
                  ? <>Don't have an account?{" "}<button onClick={() => switchView("register")} className="text-blue-600 hover:underline font-medium">Create one</button></>
                  : <>Already have an account?{" "}<button onClick={() => switchView("signin")} className="text-blue-600 hover:underline font-medium">Sign in</button></>
                }
              </p>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-gray-300 pb-6 px-8">
          © {new Date().getFullYear()} eChannelling by SLT MOBITEL. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.01 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      type="submit"
      disabled={loading}
      className="w-full py-2.5 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: "linear-gradient(135deg,#003087,#0096D6)", boxShadow: "0 4px 18px rgba(0,96,214,.3)" }}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Please wait…
        </>
      ) : (
        <>{children} <ArrowRight className="w-4 h-4" /></>
      )}
    </motion.button>
  );
}
