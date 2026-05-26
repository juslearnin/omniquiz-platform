"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RoleSelector from "./RoleSelector";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  collegeName: "",
  companyName: "",
  schoolName: "",
  admissionNumber: "",
  dob: "",
  businessName: "",
  venueAddress: "",
  clubName: "",
  idProof: "",
  bio: "",
  allowMatchmaking: false,
};

interface UserSession {
  name: string;
  role: string;
  profile?: {
    institutionName?: string | null;
    companyName?: string | null;
  } | null;
}

export default function AuthModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Session tracking state
  const [user, setUser] = useState<UserSession | null>(null);

  const [selectedRole, setSelectedRole] = useState(""); 
  const [signupStep, setSignupStep] = useState(1); // 1: Role, 2: Form, 3: OTP Verification
  const [otpCode, setOtpCode] = useState("");
  
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Check user session on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
        }
      } catch {
        console.error("Session check skipped or idle.");
      }
    }
    checkSession();
  }, []);

  const closeModal = () => {
    setOpen(false);
    setSignupStep(1);
    setSelectedRole("");
    setForm(emptyForm);
    setOtpCode("");
    setError("");
    setInfoMessage("");
    setIsForgotPassword(false);
  };

  const handleInitiateSignup = async () => {
    try {
      setLoading(true);
      setError("");
      setInfoMessage("");

      // 💡 UPDATED: Validation guard modified to allow flexible role-specific field structures
      if (!form.name || !form.password) {
        setError("Name and Password are required credentials.");
        return;
      }

      // Contextual deep check validation matching user persona constraints
      if (!form.email || !form.phone) {
        setError("Contact coordinates (Email and Phone) are mandatory parameters.");
        return;
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: selectedRole.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Verification initialization failed.");
        return;
      }

      setInfoMessage(selectedRole === "college_student" 
        ? "College email domain verified! An activation code has been dispatched to your inbox." 
        : "An activation code has been dispatched to your mobile device via SMS simulation."
      );
      setSignupStep(3);

    } catch {
      setError("Failed to initialize verification workflow.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    try {
      setLoading(true);
      setError("");

      if (!otpCode || otpCode.length < 6) {
        setError("Please enter a valid 6-digit confirmation PIN.");
        return;
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: selectedRole.toUpperCase(),
          token: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Invalid or expired confirmation code.");
        return;
      }

      alert("Account authorized and created successfully!");
      closeModal();
      window.location.reload();

    } catch {
      setError("An error occurred during transaction processing.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Invalid credentials provided.");
        return;
      }

      alert("Welcome back to the circuit!");
      closeModal();
      window.location.reload();
    } catch {
      setError("Failed to execute session login.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setLoading(true);
      setError("");
      setInfoMessage("");

      if (!form.email) {
        setError("Please supply your registered account email.");
        return;
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Failed to process recovery request.");
        return;
      }

      setInfoMessage("If that identity is configured inside our database, a fallback recovery code has been generated in your console logs.");
    } catch {
      setError("An operational failure occurred requesting password recovery.");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 POWERED UP LOGOUT ACTION ENGINE
  const handleLogout = async () => {
    // 1. Instantly pull UI down to unauthenticated state for latency mask
    setUser(null);

    // 2. Erase alternative persistent data blocks
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // 3. Clear HttpOnly server cookie through your endpoint
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Backend logout handoff error:", err);
    }

    // 4. Client-side sweep execution for non-HttpOnly fallbacks
    if (typeof window !== "undefined") {
      const currentDomain = window.location.hostname;
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;";
      document.cookie = `token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; domain=${currentDomain};`;
      document.cookie = `token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; domain=.${currentDomain.replace(/^www\./, "")};`;

      // 5. Hard link swap to kill Next.js client router cache memory
      window.location.replace("/");
    }
  };

  // 🌟 DYNAMIC RENDERING SHEET FOR SPECIFIC PERSONA DISPATCH FIELDS
  const renderRoleSpecificFields = () => {
    switch (selectedRole.toLowerCase()) {
      case "college_student":
        return (
          <>
            <input placeholder="College Name" value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Official College Domain Email (.edu / .ac.in)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
          </>
        );

      case "school_student":
        return (
          <>
            <input placeholder="School Name" value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Admission Number Reference ID" value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Personal / Parent Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Contact Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
          </>
        );

      case "qm":
      case "quizzer":
        return (
          <>
            <div className="w-full space-y-1">
              <label className="text-xs font-bold text-gray-400 px-1">DATE OF BIRTH (MUST BE &gt; 21 YEARS OLD)</label>
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50 uppercase text-sm" />
            </div>
            <input placeholder="Professional Contact Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
          </>
        );

      case "pub_host":
        return (
          <>
            <input placeholder="Business / Pub Establishment Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Full Venue Operational Street Address" value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Commercial Billing Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Host Booking Contact Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
          </>
        );

      case "quiz_club":
        return (
          <>
            <input placeholder="Society / Quizzing Club Name" value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Link to Club ID Proof / Official Verification Doc" value={form.idProof} onChange={(e) => setForm({ ...form, idProof: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Club Public Registry Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
            <input placeholder="Representative Contact Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50" />
          </>
        );

      default:
        return null;
    }
  };

  if (!mounted) return <div className="h-12 w-32 bg-white/5 animate-pulse rounded-2xl" />;

  // 🌟 COMPACT NAVBAR DISPLAY MODIFIER
  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end text-right">
          <span className="text-sm font-medium text-gray-300">
            Hi, <strong className="text-purple-400 font-bold">{user.name.split(" ")[0]}</strong>
          </span>
          {user.profile?.institutionName && (
            <span className="text-[10px] font-bold text-purple-400/80 uppercase tracking-wider">
              🏛️ {user.profile.institutionName.split(" ")[0]}
            </span>
          )}
          {user.role !== "COLLEGE_STUDENT" && user.profile?.companyName && (
            <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-wider">
              💼 {user.profile.companyName}
            </span>
          )}
        </div>
        <button 
          onClick={handleLogout}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-400 transition hover:bg-white/10 hover:text-white"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="glow rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:scale-105 hover:bg-purple-500">
        Login / Signup
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black/80 p-4 backdrop-blur-md left-0 top-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div 
              className="flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl md:p-8"
              initial={{ scale: 0.96, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-4 flex shrink-0 items-start justify-between px-1">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                    {isForgotPassword ? "Recover Password" : isLogin ? "Welcome Back" : signupStep === 1 ? "Select Your Circuit" : signupStep === 2 ? "Complete Profile" : "Validate Verification Identity"}
                  </h2>
                  <p className="mt-1 text-xs text-gray-400 md:text-sm">
                    {isForgotPassword ? "Provide your identifier to request a reset pin." : isLogin ? "Sign in to access your sets and streaks." : `Step ${signupStep} of 3`}
                  </p>
                </div>
                <button onClick={closeModal} className="rounded-full bg-white/5 p-2 text-gray-400 hover:bg-white/10 transition">✕</button>
              </div>

              {/* Internal Form Content */}
              <div 
                className="min-h-0 flex-1 overflow-y-auto pl-1 pr-3 max-h-[50vh] md:max-h-[55vh] custom-scrollbar pointer-events-auto"
                onWheel={(e) => e.stopPropagation()}
              >
                {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-semibold">⚠️ {error}</div>}
                {infoMessage && <div className="mb-4 rounded-xl bg-purple-500/10 border border-purple-500/20 p-4 text-sm text-purple-400 font-semibold">✨ {infoMessage}</div>}

                {isForgotPassword ? (
                  <div className="space-y-4 pt-2 pb-1">
                    <input 
                      placeholder="Account Email Address" 
                      value={form.email} 
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                ) : isLogin ? (
                  <div className="space-y-4 pt-2 pb-1">
                    <input 
                      placeholder="Account Email" 
                      value={form.email} 
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50"
                    />
                    <input 
                      type="password" 
                      placeholder="Password" 
                      value={form.password} 
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                ) : (
                  <div className="pt-1 pb-1">
                    {signupStep === 1 && (
                      <div className="px-1">
                        <RoleSelector selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
                      </div>
                    )}
                    
                    {signupStep === 2 && (
                      <div className="space-y-4 px-1">
                        <input 
                          placeholder="Full Name" 
                          value={form.name} 
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50"
                        />
                        <input 
                          type="password" 
                          placeholder="Create Secure Password" 
                          value={form.password} 
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/50"
                        />
                        {renderRoleSpecificFields()}
                      </div>
                    )}

                    {signupStep === 3 && (
                      <div className="space-y-4 pt-2 text-center px-1">
                        <p className="text-sm text-gray-400">Enter the 6-digit dynamic authentication pin issued to verify your credentials.</p>
                        <input 
                          maxLength={6} 
                          placeholder="000000" 
                          value={otpCode} 
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="tracking-widest text-center text-2xl font-black max-w-xs mx-auto w-full rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Layout Footer Controls */}
              <div className="mt-4 shrink-0 space-y-3 border-t border-white/5 pt-4 px-1">
                {isForgotPassword ? (
                  <div className="flex gap-3">
                    <button onClick={() => setIsForgotPassword(false)} className="rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10">Back</button>
                    <button onClick={handleForgotPassword} disabled={loading} className="glow flex-1 rounded-2xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-500 transition">{loading ? "Processing Request..." : "Dispatch Recovery Code"}</button>
                  </div>
                ) : isLogin ? (
                  <>
                    <button onClick={handleLogin} disabled={loading} className="glow w-full rounded-2xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-500 transition">{loading ? "Verifying..." : "Login"}</button>
                    <button onClick={() => { setIsForgotPassword(true); setError(""); setInfoMessage(""); }} className="w-full text-center text-xs text-gray-400 hover:text-purple-400 transition">Forgot your password?</button>
                  </>
                ) : (
                  <>
                    {signupStep === 1 ? (
                      <button
                        disabled={!selectedRole || loading}
                        onClick={() => setSignupStep(2)}
                        className="w-full rounded-2xl bg-white py-4 font-bold text-black transition hover:bg-gray-200 disabled:opacity-40"
                      >
                        Continue
                      </button>
                    ) : signupStep === 2 ? (
                      <div className="flex gap-3">
                        <button onClick={() => setSignupStep(1)} className="rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10">Back</button>
                        <button onClick={handleInitiateSignup} disabled={loading} className="glow flex-1 rounded-2xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-500 transition">{loading ? "Processing..." : "Request Verification Code"}</button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => setSignupStep(2)} className="rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10">Back</button>
                        <button onClick={handleVerifyAndRegister} disabled={loading} className="glow flex-1 rounded-2xl bg-purple-600 py-4 font-bold text-white hover:bg-purple-500 transition">{loading ? "Registering Account..." : "Confirm PIN"}</button>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setIsForgotPassword(false);
                    setSignupStep(1);
                    setError("");
                    setInfoMessage("");
                  }}
                  className="w-full text-center text-xs text-gray-500 transition hover:text-gray-300"
                >
                  {isLogin || isForgotPassword ? "New to OmniQuiz? Register your persona" : "Already registered on the platform? Login"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
