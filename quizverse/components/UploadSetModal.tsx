"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadSetModal({ isOpen, onClose }: UploadModalProps) {
  const [step, setStep] = useState(1); // 1: Metadata Core, 2: Media Slat, 3: Legal Affidavit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Core Document Asset States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("GENERAL");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questionCount, setQuestionCount] = useState(20);
  const [price, setPrice] = useState(0);

  // Historical Running Trail Assets
  const [eventName, setEventName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostedVenue, setHostedVenue] = useState("");
  
  // Rich Multimedia Mappings
  const [hasMedia, setHasMedia] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaSlideIndex, setMediaSlideIndex] = useState(1);

  // Structural Copyright Sign-off Hook
  const [signedAffidavit, setSignedAffidavit] = useState(false);

  const resetForm = () => {
    setStep(1);
    setTitle("");
    setDescription("");
    setGenre("GENERAL");
    setDifficulty("MEDIUM");
    setQuestionCount(20);
    setPrice(0);
    setEventName("");
    setHostName("");
    setHostedVenue("");
    setHasMedia(false);
    setAudioUrl("");
    setVideoUrl("");
    setMediaSlideIndex(1);
    setSignedAffidavit(false);
    setError("");
    setSuccessMsg("");
  };

  // Pre-validate input prices against the mathematical valuation formula on the server
  const handleVerifyPricing = async () => {
    try {
      setLoading(true);
      setError("");

      const mediaCount = (audioUrl ? 1 : 0) + (videoUrl ? 1 : 0);

      const res = await fetch("/api/auth/quiz-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VALIDATE_UPLOAD",
          inputPrice: Number(price),
          questionCount: Number(questionCount),
          mediaCount
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed validation.");
        return;
      }

      // If price checks pass, proceed to final signoff
      setStep(3);
    } catch {
      setError("Network validation fault checking pricing formulas.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteUploadCommit = async () => {
    if (!signedAffidavit) {
      setError("You must explicitly review and sign the creator affidavit to deploy sets.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        title, description, genre, difficulty,
        price: Number(price),
        questionCount: Number(questionCount),
        fileUrl: "https://storage.googleapis.com/omniquiz-buckets/mock-set.pdf", // Main carrier track placeholder
        fileType: "PDF",
        eventName, hostName, hostedVenue,
        audioUrl: hasMedia ? audioUrl : null,
        videoUrl: hasMedia ? videoUrl : null,
        mediaSlideIndex: hasMedia ? Number(mediaSlideIndex) : null,
        signedAffidavit
      };

      // 🌟 SWAPPED TO LIVE ACTION STREAM ROUTE
      const res = await fetch("/api/auth/quiz-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to commit data to database arrays.");
        return;
      }
      
      setSuccessMsg("Quiz Set successfully initialized, verified, and pushed to discovery index grids!");
      setTimeout(() => {
        resetForm();
        onClose();
        window.location.reload(); // Refresh to populate discovery feed grids instantly
      }, 2000);

    } catch {
      setError("Failed to execute data transaction stream.");
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black/80 p-4 backdrop-blur-md left-0 top-0">
        <motion.div 
          className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl md:p-8"
          initial={{ scale: 0.96, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 16, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Progress Matrix */}
          <div className="mb-6 flex shrink-0 items-start justify-between border-b border-white/5 pb-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-purple-500">Step {step} of 3</span>
              <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                {step === 1 && "Curated Metadata Core"}
                {step === 2 && "Multimedia Anchor Tracks"}
                {step === 3 && "Legal Integrity Affidavit"}
              </h2>
            </div>
            <button onClick={() => { resetForm(); onClose(); }} className="rounded-full bg-white/5 p-2 text-gray-400 hover:bg-white/10 transition">✕</button>
          </div>

          {/* Core Content Views (Scrollable) */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-semibold">⚠️ {error}</div>}
            {successMsg && <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4 text-sm text-purple-400 font-semibold">✨ {successMsg}</div>}

            {step === 1 && (
              <div className="space-y-4 pt-1">
                <input placeholder="Quiz Set Title (e.g., Millennium Mania Final)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/40" />
                <textarea rows={3} placeholder="Set Description & Curation Notes..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/40 resize-none" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 px-1">Circuit Genre</label>
                    <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#121214] p-4 text-white outline-none focus:border-purple-500/40">
                      <option value="GENERAL">General Trivia</option>
                      <option value="MELA">MELA (Music, Entertainment, Lit, Arts)</option>
                      <option value="TLC">TLC (Travel, Living, Culture)</option>
                      <option value="SCI_TECH">Sci-Tech</option>
                      <option value="BIZ_TECH">Biz-Tech / Brands</option>
                      <option value="INDIA">India & Heritage</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 px-1">Total Question Volume (Q Metric)</label>
                    <input type="number" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-purple-500/40" />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 space-y-4">
                  <h3 className="text-sm font-black text-gray-400 tracking-wide uppercase px-1">Historical Running Context Trail</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input placeholder="Fest / Event Name" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
                    <input placeholder="Hosting Venue / College" value={hostedVenue} onChange={(e) => setHostedVenue(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
                    <input placeholder="Conductor Host Name" value={hostName} onChange={(e) => setHostName(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
                  </div>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-4">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 px-1">Marketplace Pricing (Set to ₹0 for Voluntary Gift)</label>
                  <input type="number" placeholder="₹ Price Tag Value" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-white outline-none font-bold" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Does this set incorporate multimedia rounds?</h4>
                    <p className="text-xs text-gray-400">Enable this to map streaming audio samples or YouTube clips to specific slides.</p>
                  </div>
                  <input type="checkbox" checked={hasMedia} onChange={(e) => setHasMedia(e.target.checked)} className="h-5 w-5 accent-purple-500 cursor-pointer" />
                </div>

                {hasMedia && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-gray-500 px-1">Audio Track Link Asset (.mp3 stream location)</label>
                      <input placeholder="https://domain.com/assets/round-audio.mp3" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-gray-500 px-1">Video Round Embed Path (YouTube / Vimeo Link Link)</label>
                      <input placeholder="https://www.youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-gray-500 px-1">Slide Index Trigger Number</label>
                      <input type="number" min={1} value={mediaSlideIndex} onChange={(e) => setMediaSlideIndex(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 pt-2">
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 text-sm text-gray-300 leading-relaxed space-y-4">
                  <h3 className="font-black text-purple-400 tracking-wide uppercase text-xs">📜 CREATOR INTEGRITY UNDERTAKING</h3>
                  <p>&quot;I explicitly declare that this material consists of original arrangements, researched text, or curated sets owned by myself or my organizing collective.&quot;</p>
                  <p>&quot;I verify that this file does not infringe on active copyright boundaries, non-disclosure agreements, or proprietary corporate intellectual properties.&quot;</p>
                  <p>&quot;I acknowledge that plagiarized or verified stolen properties will trigger an automatic account ban and immediate blacklisting from the OmniQuiz workspace circuit.&quot;</p>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.01] p-4 cursor-pointer" onClick={() => setSignedAffidavit(!signedAffidavit)}>
                  <input type="checkbox" checked={signedAffidavit} onChange={() => {}} className="h-5 w-5 mt-0.5 accent-purple-500 cursor-pointer shrink-0" />
                  <span className="text-xs font-semibold text-gray-400 leading-normal">
                    I have thoroughly reviewed the governance terms, accept full accountability for the originality of this work, and digitally sign this legal affidavit undertaking.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Step Bar */}
          <div className="mt-6 flex shrink-0 gap-3 border-t border-white/5 pt-4">
            {step > 1 && (
              <button disabled={loading} onClick={() => setStep(step - 1)} className="rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10">
                Back
              </button>
            )}
            
            {step === 1 && (
              <button disabled={!title || loading} onClick={() => setStep(2)} className="glow flex-1 rounded-2xl bg-purple-600 py-4 font-bold text-white disabled:opacity-40">
                Continue to Media Elements
              </button>
            )}

            {step === 2 && (
              <button disabled={loading} onClick={handleVerifyPricing} className="glow flex-1 rounded-2xl bg-purple-600 py-4 font-bold text-white">
                {loading ? "Verifying Formula Metrics..." : "Validate System Pricing"}
              </button>
            )}

            {step === 3 && (
              <button disabled={!signedAffidavit || loading} onClick={handleExecuteUploadCommit} className="glow flex-1 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-4 font-bold text-white disabled:opacity-30">
                {loading ? "Deploying Asset Bundle..." : "Sign Affidavit & Publish"}
              </button>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
