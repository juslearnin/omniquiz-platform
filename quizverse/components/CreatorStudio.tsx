"use client";

import {
  ChangeEvent,
  DragEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

interface AnalyticsData {
  grossRevenue: number;
  netWallet: number;
  totalViews: number;
  totalDownloads: number;
}

interface StudioProps {
  analytics: AnalyticsData;
  userContributions: number;
  showLedger: boolean;
  onUploadSuccess: () => void;
}

interface BufferedFile {
  name: string;
  payload: string;
  size: number;
  fileType: "PDF" | "PPTX";
}

interface CreatorAsset {
  id: string;
  title: string;
  genre: string;
  questionCount: number;
  uniqueViews: number;
  downloadCount: number;
  price: number;
  isPlagiarized: boolean;
  uploaderId: string;
}

interface CurrentUser {
  id: string;
  profile?: {
    ratingAverage?: number;
    contributions?: number;
  } | null;
}

interface Particle {
  x: number;
  y: number;
  alpha: number;
  radius: number;
  velocityY: number;
}

const MAX_FILE_BYTES = 45 * 1024 * 1024;
const ACCEPTED_TYPES = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

function publishStudioSync(quizId: string) {
  if (typeof window === "undefined") return;
  const payload = { type: "upload", quizId, at: Date.now() };
  try {
    window.localStorage.setItem("omniquiz_live_event", JSON.stringify(payload));
  } catch {
    // Local storage is a best-effort sync mirror.
  }
  try {
    const channel = new BroadcastChannel("omniquiz-live");
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel is optional.
  }
}

function formatBytes(size: number) {
  if (!size) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

function genreMultiplier(genre: string) {
  const normalized = genre.toUpperCase();
  if (normalized.includes("MELA") || normalized.includes("TLC")) return 1.5;
  if (normalized.includes("BIZ") || normalized.includes("SCI")) return 1.25;
  return 1;
}

function calculateTargetPrice(questionCount: number, ratingAverage: number, genre: string) {
  return Math.max(
    0,
    Math.round((Math.max(1, questionCount) / 10) * Math.max(1, ratingAverage || 1) * genreMultiplier(genre)),
  );
}

export default function CreatorStudio({
  analytics,
  userContributions,
  onUploadSuccess,
}: StudioProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [assets, setAssets] = useState<CreatorAsset[]>([]);
  const [showEconomics, setShowEconomics] = useState(false);
  const [bufferedFile, setBufferedFile] = useState<BufferedFile | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [isBufferingFile, setIsBufferingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [price, setPrice] = useState(0);
  const [signedAffidavit, setSignedAffidavit] = useState(false);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleDiscount, setBundleDiscount] = useState(15);
  const [bundleNotice, setBundleNotice] = useState("");

  const contributions = currentUser?.profile?.contributions ?? userContributions;
  const effectiveContributions = Math.max(contributions, assets.length);
  const ratingAverage = currentUser?.profile?.ratingAverage ?? 1;
  const creatorLevel = useMemo(() => {
    if (effectiveContributions >= 10) return 3;
    if (effectiveContributions > 3) return 2;
    return 1;
  }, [effectiveContributions]);
  const canCharge = effectiveContributions > 3;
  const hasVerifiedUploads = assets.length > 0;
  const genreValue = customGenre.trim() ? customGenre.trim().toUpperCase() : "GENERAL";
  const recommendedPrice = calculateTargetPrice(questionCount, ratingAverage, genreValue);
  const canSubmit = Boolean(title.trim() && bufferedFile && signedAffidavit && !loading);
  const genrePills = customGenre
    .split(",")
    .map((genre) => genre.trim().toUpperCase())
    .filter(Boolean);
  const selectedBundleAssets = assets.filter((asset) => selectedBundleIds.includes(asset.id));
  const bundleGross = selectedBundleAssets.reduce((total, asset) => total + asset.price, 0);
  const bundlePrice = Math.max(0, Math.round(bundleGross * (1 - bundleDiscount / 100)));

  const fetchCreatorAssets = useCallback(async () => {
    try {
      const [meResponse, feedResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/quizzes/trending", { cache: "no-store" }),
      ]);
      const meData = await meResponse.json();
      const feedData = await feedResponse.json();
      if (meData?.success && meData.user) {
        setCurrentUser(meData.user as CurrentUser);
      }
      if (meData?.user?.id && feedData?.success) {
        const mine = (feedData.quizzes as CreatorAsset[]).filter(
          (asset) => asset.uploaderId === meData.user.id,
        );
        setAssets(mine);
      }
    } catch (error) {
      console.error("Creator asset sync failed:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCreatorAssets();
  }, [fetchCreatorAssets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const activeCanvas = canvas;
    const drawingContext = context;

    function resize() {
      const bounds = activeCanvas.getBoundingClientRect();
      activeCanvas.width = Math.max(1, Math.floor(bounds.width * window.devicePixelRatio));
      activeCanvas.height = Math.max(1, Math.floor(bounds.height * window.devicePixelRatio));
      drawingContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }

    function draw() {
      const bounds = activeCanvas.getBoundingClientRect();
      drawingContext.clearRect(0, 0, bounds.width, bounds.height);

      if (mouseRef.current.active) {
        particlesRef.current.push({
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          alpha: 0.85,
          radius: 2 + Math.random() * 3,
          velocityY: 0.6 + Math.random() * 1.4,
        });
        drawingContext.save();
        drawingContext.strokeStyle = "rgba(216,180,254,0.95)";
        drawingContext.shadowBlur = 18;
        drawingContext.shadowColor = "rgba(192,132,252,0.95)";
        drawingContext.lineWidth = 1.5;
        drawingContext.beginPath();
        drawingContext.moveTo(mouseRef.current.x - 10, mouseRef.current.y);
        drawingContext.lineTo(mouseRef.current.x + 10, mouseRef.current.y);
        drawingContext.moveTo(mouseRef.current.x, mouseRef.current.y - 10);
        drawingContext.lineTo(mouseRef.current.x, mouseRef.current.y + 10);
        drawingContext.stroke();
        drawingContext.restore();
      }

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          y: particle.y - particle.velocityY,
          alpha: particle.alpha - 0.04,
        }))
        .filter((particle) => particle.alpha > 0);

      for (const particle of particlesRef.current) {
        drawingContext.beginPath();
        drawingContext.fillStyle = `rgba(216,180,254,${particle.alpha})`;
        drawingContext.shadowBlur = 16;
        drawingContext.shadowColor = "rgba(192,132,252,0.8)";
        drawingContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        drawingContext.fill();
      }

      animationRef.current = window.setTimeout(() => {
        animationRef.current = window.requestAnimationFrame(draw);
      }, 25);
    }

    resize();
    window.addEventListener("resize", resize);
    animationRef.current = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    };
  }, []);

  function handleStudioMouseMove(event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      active: true,
    };
  }

  function detectFileType(file: File): "PDF" | "PPTX" | null {
    const name = file.name.toLowerCase();
    if (file.type === ACCEPTED_TYPES.pdf || name.endsWith(".pdf")) return "PDF";
    if (file.type === ACCEPTED_TYPES.pptx || name.endsWith(".pptx")) return "PPTX";
    return null;
  }

  function startProgressTicker() {
    setUploadPercent(0);
    if (progressRef.current) window.clearInterval(progressRef.current);
    progressRef.current = window.setInterval(() => {
      setUploadPercent((current) => {
        if (current >= 94) return current;
        return Math.min(94, current + Math.ceil(Math.random() * 8));
      });
    }, 90);
  }

  function stopProgressTicker() {
    if (progressRef.current) window.clearInterval(progressRef.current);
    progressRef.current = null;
    setUploadPercent(100);
  }

  function bufferFile(file: File, resetInput?: () => void) {
    if (typeof window === "undefined") return;
    const fileType = detectFileType(file);
    if (!fileType) {
      alert("Please upload a PDF or PPTX packet.");
      resetInput?.();
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      alert("This document is larger than 45MB. Please compress or split the packet before upload.");
      resetInput?.();
      return;
    }

    setIsBufferingFile(true);
    setBufferedFile(null);
    startProgressTicker();

    const reader = new FileReader();
    reader.onerror = () => {
      setIsBufferingFile(false);
      setUploadPercent(0);
      if (progressRef.current) window.clearInterval(progressRef.current);
      alert("Unable to read that document packet.");
    };
    reader.onload = () => {
      stopProgressTicker();
      setBufferedFile({
        name: file.name,
        payload: String(reader.result || ""),
        size: file.size,
        fileType,
      });
      window.setTimeout(() => setIsBufferingFile(false), 250);
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    bufferFile(file, () => {
      event.target.value = "";
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) bufferFile(file);
  }

  async function handleDeploySet() {
    if (!canSubmit || !bufferedFile) return;
    setLoading(true);

    try {
      const response = await fetch("/api/auth/quiz-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: "Uploaded from Creator Studio runway.",
          genre: genreValue,
          difficulty: "MEDIUM",
          price: canCharge ? Number(price || recommendedPrice) : 0,
          questionCount: Number(questionCount),
          fileName: bufferedFile.name,
          fileUrl: bufferedFile.payload,
          fileType: bufferedFile.fileType,
          signedAffidavit,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Upload failed.");
      }

      setTitle("");
      setCustomGenre("");
      setQuestionCount(20);
      setPrice(0);
      setSignedAffidavit(false);
      setBufferedFile(null);
      setUploadPercent(0);
      await fetchCreatorAssets();
      publishStudioSync(String(data.quizId || ""));
      onUploadSuccess();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleBundleAsset(assetId: string) {
    setSelectedBundleIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  function compileBundle() {
    if (selectedBundleAssets.length < 2 || !bundleTitle.trim()) return;
    setBundleNotice(
      `"${bundleTitle.trim()}" staged with ${selectedBundleAssets.length} sets at Rs ${bundlePrice}.`,
    );
  }

  return (
    <section
      className="relative w-full cursor-none space-y-8 overflow-hidden text-left"
      onMouseEnter={() => {
        mouseRef.current.active = true;
      }}
      onMouseLeave={() => {
        mouseRef.current.active = false;
      }}
      onMouseMove={handleStudioMouseMove}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />

      <div className="rounded-[34px] border border-white/10 bg-white/[0.025] p-6 shadow-2xl backdrop-blur-2xl md:p-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-purple-100">
                <MousePointer2 className="h-3 w-3" />
                Creator Runway
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                Standing Tier {creatorLevel}
              </span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
              Dispatch Core Document Packet
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowEconomics(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200 transition hover:scale-[1.01] hover:bg-white/10"
          >
            <Info size={15} />
            Economics
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <label className="block space-y-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-purple-200">
                Drag & Drop Multi-Chunk Buffer Tube
              </span>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[26px] border border-dashed border-purple-300/20 bg-white/[0.035] p-8 text-center transition hover:scale-[1.01] hover:border-purple-300/50"
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                  onChange={handleFileChange}
                  disabled={isBufferingFile || loading}
                  className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-wait"
                />
                <AnimatePresence mode="wait">
                  {isBufferingFile && (
                    <motion.div
                      key="buffering"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full max-w-sm space-y-5"
                    >
                      <div className="relative mx-auto h-16 w-16">
                        <div className="absolute inset-0 rounded-full border border-purple-300/20" />
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-purple-200" />
                        <Loader2 className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-purple-200" />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-400 to-cyan-300"
                          animate={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
                        {uploadPercent}% Sync Completed
                      </p>
                    </motion.div>
                  )}
                  {!isBufferingFile && bufferedFile && (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="space-y-3"
                    >
                      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-200">
                        Document Sealed & Verified
                      </p>
                      <p className="mx-auto max-w-md truncate text-xs text-zinc-500">
                        {bufferedFile.name} - {formatBytes(bufferedFile.size)} - {bufferedFile.fileType}
                      </p>
                    </motion.div>
                  )}
                  {!isBufferingFile && !bufferedFile && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <FileUp className="mx-auto h-12 w-12 text-zinc-500" />
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">
                        Upload PDF or PPTX packet up to 45MB
                      </p>
                      <p className="text-xs text-zinc-600">
                        FileReader converts it into persistent Base64 for preview, download, and hydration-safe storage.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </label>

            <div className="space-y-3">
              <input
                placeholder="Custom quiz title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-300/40"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  placeholder="Genre tags, comma separated"
                  value={customGenre}
                  onChange={(event) => setCustomGenre(event.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-300/40"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Question tally"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-300/40"
                />
              </div>
              {genrePills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {genrePills.map((genre) => (
                    <span key={genre} className="rounded-full border border-purple-300/25 bg-purple-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-100">
                      {genre}
                    </span>
                  ))}
                </div>
              )}
              {canCharge ? (
                <div className="space-y-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-blue-100">
                    <span>Formula target: Rs {recommendedPrice}</span>
                    <span>({questionCount}/10 x {ratingAverage.toFixed(1)} x {genreMultiplier(genreValue).toFixed(1)})</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    placeholder="Custom price in Rs"
                    value={price || recommendedPrice}
                    onChange={(event) => setPrice(Number(event.target.value))}
                    className="w-full rounded-xl border border-blue-400/20 bg-black/20 px-4 py-4 text-sm font-bold text-blue-100 outline-none transition placeholder:text-blue-200/40 focus:border-blue-300/50"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100 shadow-[0_0_30px_rgba(251,191,36,0.08)]">
                  Reputation Mode: Publish 3 Free Verified Sets to Seed Network Trust.
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:scale-[1.01] hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  checked={signedAffidavit}
                  onChange={(event) => setSignedAffidavit(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-purple-500"
                />
                <span className="text-sm leading-relaxed text-zinc-400">
                  I certify original curation metrics. Plagiarized bundles trigger bans.
                </span>
              </label>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleDeploySet}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:scale-[1.01] hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={16} />}
                {loading ? "Deploying..." : "Deploy Live Set To Circuit Index Grids"}
              </button>
            </div>
          </div>

          <aside className="space-y-5 border-t border-white/10 pt-6 xl:col-span-5 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
            {hasVerifiedUploads ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-purple-200">
                  <BarChart3 size={15} />
                  Dual-Tier Live Yield Diagnostics
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Gross Revenue" value={`Rs ${analytics.grossRevenue}`} />
                  <Stat label="Net Wallet 70%" value={`Rs ${analytics.netWallet}`} accent />
                  <Stat label="Fleet Views" value={analytics.totalViews} />
                  <Stat label="Global Pulls" value={analytics.totalDownloads} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[170px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
                <BarChart3 className="mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Analytics Console Idle
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                <Boxes className="h-4 w-4 text-purple-200" />
                Combo Pack Compiler
              </div>
              {assets.length > 2 ? (
                <div className="space-y-3">
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {assets.map((asset) => (
                      <label key={asset.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedBundleIds.includes(asset.id)}
                          onChange={() => toggleBundleAsset(asset.id)}
                          className="accent-purple-500"
                        />
                        <span className="min-w-0 flex-1 truncate">{asset.title}</span>
                        <span className="text-xs font-black text-purple-200">Rs {asset.price}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    value={bundleTitle}
                    onChange={(event) => setBundleTitle(event.target.value)}
                    placeholder="Bundle header"
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none"
                  />
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={bundleDiscount}
                    onChange={(event) => setBundleDiscount(Number(event.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <div className="text-xs font-bold text-zinc-400">
                    Discount {bundleDiscount}% - staged bundle price Rs {bundlePrice}
                  </div>
                  <button
                    type="button"
                    onClick={compileBundle}
                    disabled={selectedBundleAssets.length < 2 || !bundleTitle.trim()}
                    className="w-full rounded-xl bg-purple-600 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:scale-[1.01] disabled:opacity-40"
                  >
                    Compile Combo Ticket
                  </button>
                  {bundleNotice && <p className="text-xs font-semibold text-emerald-200">{bundleNotice}</p>}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-500">
                  Publish more than two live uploads to unlock bundle compilation.
                </p>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-purple-200">
            <Sparkles className="h-4 w-4" />
            Standalone Micro-Analytics Per Asset
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Genre</th>
                  <th className="px-3 py-2">Views</th>
                  <th className="px-3 py-2">Downloads</th>
                  <th className="px-3 py-2">Claims</th>
                  <th className="px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {assets.length ? (
                  assets.map((asset) => (
                    <tr key={asset.id} className="rounded-2xl bg-white/[0.03] text-zinc-300">
                      <td className="rounded-l-2xl px-3 py-3 font-bold text-white">{asset.title}</td>
                      <td className="px-3 py-3">{asset.genre}</td>
                      <td className="px-3 py-3">{asset.uniqueViews}</td>
                      <td className="px-3 py-3">{asset.downloadCount}</td>
                      <td className="px-3 py-3">{asset.isPlagiarized ? "1 active" : "0 clear"}</td>
                      <td className="rounded-r-2xl px-3 py-3">{asset.price === 0 ? "Free" : `Rs ${asset.price}`}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-zinc-500">
                      No verified uploads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEconomics && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[#07070c] p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-white">
                  Platform Economics Operational Guide
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEconomics(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10"
                  aria-label="Close economics"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
                <p>
                  Price Target = (Question Count / 10 x Rating Average) x Genre Multiplier. General sets use 1.0, high-demand MELA/TLC bundles use 1.5.
                </p>
                <p>
                  The first three verified contributions are forced to Rs 0. Once a creator has more than three active sets, custom pricing unlocks.
                </p>
                <p>
                  Revenue split remains 70:30. Verified creators receive 70% net wallet yield while 30% is routed to network maintenance and moderation overhead.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-purple-400/25 bg-purple-400/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-purple-100" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
