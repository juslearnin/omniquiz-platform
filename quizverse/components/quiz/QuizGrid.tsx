"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, WheelEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Flag,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Radio,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const LIVE_CHANNEL = "omniquiz-live";
const LIVE_STORAGE_KEY = "omniquiz_live_event";
const MAX_PREVIEW_PAGES = 10;

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: string | { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<PdfPageProxy>;
    }>;
  };
};

type LiveEventType = "view" | "download" | "review" | "delete" | "dispute" | "upload";

type LiveEvent = {
  type: LiveEventType;
  quizId: string;
  at: number;
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

interface RatingRecord {
  id: string;
  score: number;
  reviewText: string | null;
  userId: string;
  createdAt: string;
}

interface QuizUploader {
  id: string;
  name: string;
  email?: string;
  profile?: {
    institutionName?: string | null;
  } | null;
}

interface QuizSetRecord {
  id: string;
  title: string;
  description?: string | null;
  genre: string;
  questionCount: number;
  uniqueViews: number;
  downloadCount: number;
  price: number;
  fileUrl: string;
  fileType: string;
  createdAt: string;
  uploaderId: string;
  isPlagiarized: boolean;
  uploader: QuizUploader;
  ratings: RatingRecord[];
}

interface ActiveSession {
  id: string;
  email?: string | null;
}

interface GridProps {
  syncSignal: number;
  currentUserId: string | null;
  currentUserEmail?: string | null;
  onDataSync: (data: {
    grossRevenue: number;
    netWallet: number;
    totalViews: number;
    totalDownloads: number;
  }) => void;
  onActionExecuted: () => void;
}

function safeFilename(value: string) {
  return `${value || "quiz-pack"}`
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function base64ToBytes(payload: string) {
  const raw = payload.includes(",") ? payload.split(",").pop() || "" : payload;
  const binary = window.atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function payloadToBlobUrl(payload: string, fileType: string) {
  if (/^https?:\/\//i.test(payload) || payload.startsWith("blob:")) {
    return { url: payload, revoke: () => undefined };
  }
  const blob = new Blob([base64ToBytes(payload)], {
    type:
      fileType === "PPTX"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

async function loadPdfJs() {
  if (typeof window === "undefined") throw new Error("PDF rendering is browser-only.");
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return window.pdfjsLib;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PDFJS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF.js failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF.js failed to load."));
    document.head.appendChild(script);
  });

  const pdfjs = window.pdfjsLib as PdfJsLib | undefined;
  if (!pdfjs) throw new Error("PDF.js did not attach to window.");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return pdfjs;
}

function campusBadge(uploader: QuizUploader) {
  const email = uploader.email?.toLowerCase() || "";
  const institution = uploader.profile?.institutionName || "";
  if (email.endsWith("@iitism.ac.in") || /ism|dhanbad/i.test(institution)) return "IIT (ISM) DHANBAD";
  if (email.endsWith("@iitb.ac.in") || /bombay/i.test(institution)) return "IIT BOMBAY";
  return institution || "GLOBAL CAMPUS";
}

function creatorHandle(name: string) {
  const first = name.trim().split(/\s+/)[0] || "creator";
  return first.replace(/[^a-z0-9]/gi, "");
}

function publishLiveEvent(type: LiveEventType, quizId: string) {
  if (typeof window === "undefined") return;
  const payload: LiveEvent = { type, quizId, at: Date.now() };
  try {
    window.localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Local storage can be unavailable in private contexts.
  }
  try {
    const channel = new BroadcastChannel(LIVE_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel is a progressive enhancement.
  }
}

function isSameEmail(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function PdfCover({ quiz }: { quiz: QuizSetRecord }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (typeof window === "undefined" || quiz.fileType === "PPTX" || !canvasRef.current) return;

    let cancelled = false;
    async function renderFirstPage() {
      try {
        setStatus("loading");
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        const source = /^https?:\/\//i.test(quiz.fileUrl)
          ? quiz.fileUrl
          : { data: base64ToBytes(quiz.fileUrl) };
        const pdf = await pdfjs.getDocument(source).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.7 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.clearRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } catch (error) {
        console.error("PDF cover render failed:", error);
        if (!cancelled) setStatus("failed");
      }
    }
    void renderFirstPage();
    return () => {
      cancelled = true;
    };
  }, [quiz.fileType, quiz.fileUrl]);

  return (
    <div className="relative aspect-[16/9] max-h-[245px] w-full overflow-hidden rounded-[20px] border border-orange-300/40 bg-[#fbfaf7] shadow-[0_14px_42px_rgba(15,23,42,0.14)]">
      <canvas
        ref={canvasRef}
        className={`h-full w-full object-cover transition duration-700 ${
          status === "ready" ? "opacity-100" : "scale-[1.02] opacity-0"
        }`}
      />
      <AnimatePresence>
        {status !== "ready" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-between bg-[linear-gradient(145deg,#fff7ed,#fff_46%,#f8fafc)] p-7 text-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-700">
                Page 01
              </span>
              {status === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="space-y-4">
              <div className="grid gap-2">
                <span className="h-2 w-4/5 animate-pulse rounded-full bg-slate-200" />
                <span className="h-2 w-2/3 animate-pulse rounded-full bg-orange-200" />
                <span className="h-2 w-5/6 animate-pulse rounded-full bg-slate-100" />
              </div>
              <h3 className="text-4xl font-black uppercase leading-none text-slate-900">{quiz.title}</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">
                {status === "failed" ? "Fallback thumbnail" : "Rendering thumbnail"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PdfPreviewModal({
  quiz,
  onClose,
}: {
  quiz: QuizSetRecord;
  onClose: () => void;
}) {
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState("Preparing first 10 pages...");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function renderPreview() {
      try {
        setStatus("Loading secure preview...");
        const pdfjs = await loadPdfJs();
        const source = /^https?:\/\//i.test(quiz.fileUrl)
          ? quiz.fileUrl
          : { data: base64ToBytes(quiz.fileUrl) };
        const pdf = await pdfjs.getDocument(source).promise;
        const pages = Math.min(pdf.numPages, MAX_PREVIEW_PAGES);
        setPageCount(pages);

        await new Promise((resolve) => window.setTimeout(resolve, 60));
        for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
          if (cancelled) return;
          setStatus(`Rendering page ${pageNumber} of ${pages}...`);
          const canvas = canvasRefs.current[pageNumber];
          const context = canvas?.getContext("2d");
          if (!canvas || !context) continue;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.35 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
        }
        if (!cancelled) setStatus(`Preview capped at first ${pages} page${pages === 1 ? "" : "s"}.`);
      } catch (error) {
        console.error("PDF preview render failed:", error);
        if (!cancelled) setStatus("Preview failed. Download remains available.");
      }
    }

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [quiz.fileUrl]);

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-orange-200/30 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black uppercase tracking-[0.14em] text-slate-950">
              {quiz.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Preview limited to page 1 through page {MAX_PREVIEW_PAGES}. Full file is available through download.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:scale-[1.01] hover:bg-slate-100"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-100/70 p-5">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {Array.from({ length: pageCount || MAX_PREVIEW_PAGES }, (_, index) => index + 1).map((pageNumber) => (
              <div
                key={pageNumber}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
              >
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Page {pageNumber}
                </div>
                <canvas
                  ref={(node) => {
                    canvasRefs.current[pageNumber] = node;
                  }}
                  className="w-full rounded-xl bg-white"
                />
              </div>
            ))}
            <p className="text-center text-xs font-bold text-slate-500">{status}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function QuizGrid({
  syncSignal,
  currentUserId,
  currentUserEmail,
  onDataSync,
  onActionExecuted,
}: GridProps) {
  const [quizzes, setQuizzes] = useState<QuizSetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyQuizId, setBusyQuizId] = useState<string | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reviewInput, setReviewInput] = useState("");
  const [scoreInput, setScoreInput] = useState(5);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<QuizSetRecord | null>(null);
  const [checkoutQuiz, setCheckoutQuiz] = useState<QuizSetRecord | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const viewedRegistry = useRef<Set<string>>(new Set());
  const downloadedRegistry = useRef<Set<string>>(new Set());
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const effectiveUserId = activeSession?.id || currentUserId;
  const effectiveUserEmail = activeSession?.email || currentUserEmail;

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data.user) {
        setActiveSession({ id: data.user.id, email: data.user.email });
      } else {
        setActiveSession(null);
      }
    } catch {
      setActiveSession(null);
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/quizzes/trending", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load feed.");
      const nextQuizzes = data.quizzes as QuizSetRecord[];
      setQuizzes(nextQuizzes);

      const mine = effectiveUserId
        ? nextQuizzes.filter(
            (quiz) =>
              quiz.uploaderId === effectiveUserId || isSameEmail(effectiveUserEmail, quiz.uploader.email),
          )
        : [];
      const grossRevenue = mine.reduce((total, quiz) => total + quiz.price * quiz.downloadCount, 0);
      onDataSync({
        grossRevenue,
        netWallet: Math.round(grossRevenue * 0.7),
        totalViews: mine.reduce((total, quiz) => total + quiz.uniqueViews, 0),
        totalDownloads: mine.reduce((total, quiz) => total + quiz.downloadCount, 0),
      });
    } catch (error) {
      console.error("Feed sync failed:", error);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserEmail, effectiveUserId, onDataSync]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession, syncSignal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchFeed();
  }, [fetchFeed, syncSignal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchFeed();
        void refreshSession();
      }
    }, 4500);
    const onFocus = () => {
      void fetchFeed();
      void refreshSession();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchFeed, refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let channel: BroadcastChannel | null = null;
    const refreshFromEvent = (event?: LiveEvent) => {
      if (!event || ["view", "download", "review", "delete", "dispute", "upload"].includes(event.type)) {
        void fetchFeed();
        onActionExecuted();
      }
    };

    try {
      channel = new BroadcastChannel(LIVE_CHANNEL);
      channel.onmessage = (event: MessageEvent<LiveEvent>) => refreshFromEvent(event.data);
    } catch {
      channel = null;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== LIVE_STORAGE_KEY || !event.newValue) return;
      try {
        refreshFromEvent(JSON.parse(event.newValue) as LiveEvent);
      } catch {
        refreshFromEvent();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchFeed, onActionExecuted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applySearch = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: string }>).detail;
      setQuery(detail?.value || "");
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(window.localStorage.getItem("omniquiz_search") || "");
    window.addEventListener("omniquiz-search", applySearch);
    return () => window.removeEventListener("omniquiz-search", applySearch);
  }, []);

  const filteredQuizzes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quizzes;
    return quizzes.filter((quiz) =>
      [quiz.title, quiz.genre, quiz.description || "", quiz.uploader.name, quiz.uploader.email || "", campusBadge(quiz.uploader)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, quizzes]);

  const averageScoreByQuiz = useMemo(() => {
    return quizzes.reduce<Record<string, number>>((accumulator, quiz) => {
      accumulator[quiz.id] = quiz.ratings.length
        ? quiz.ratings.reduce((total, rating) => total + rating.score, 0) / quiz.ratings.length
        : 0;
      return accumulator;
    }, {});
  }, [quizzes]);

  function rememberInteraction(quizId: string) {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("omniquiz_recent_quiz_ids");
    const history = raw ? (JSON.parse(raw) as string[]) : [];
    window.localStorage.setItem(
      "omniquiz_recent_quiz_ids",
      JSON.stringify([quizId, ...history.filter((id) => id !== quizId)].slice(0, 12)),
    );
  }

  function updateQuizCounters(quizId: string, counters: Partial<Pick<QuizSetRecord, "uniqueViews" | "downloadCount">>) {
    setQuizzes((current) =>
      current.map((quiz) => (quiz.id === quizId ? { ...quiz, ...counters } : quiz)),
    );
  }

  async function guestCanView(quizId: string) {
    const response = await fetch("/api/auth/quiz-guest-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      setModalMessage(data?.error || "Please log in to preview more than 2 packs per day.");
      return false;
    }
    updateQuizCounters(quizId, { uniqueViews: Number(data.uniqueViews || 0) });
    publishLiveEvent("view", quizId);
    return true;
  }

  async function trackView(quiz: QuizSetRecord) {
    rememberInteraction(quiz.id);
    if (!currentUserId) return guestCanView(quiz.id);
    const isOwner = currentUserId === quiz.uploaderId || isSameEmail(currentUserEmail, quiz.uploader.email);
    if (isOwner || viewedRegistry.current.has(quiz.id)) return true;

    viewedRegistry.current.add(quiz.id);
    const response = await fetch("/api/auth/quiz-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "VERIFY_ACCESS", quizId: quiz.id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.limitExceeded) {
      viewedRegistry.current.delete(quiz.id);
      setModalMessage(data?.error || "Preview limit reached. Premium pass required.");
      return false;
    }
    updateQuizCounters(quiz.id, { uniqueViews: Number(data?.uniqueViews || quiz.uniqueViews) });
    publishLiveEvent("view", quiz.id);
    return true;
  }

  async function openPreview(quiz: QuizSetRecord) {
    try {
      if (typeof window === "undefined") return;
      const allowed = await trackView(quiz);
      if (!allowed) return;
      setPreviewQuiz(quiz);
      onActionExecuted();
      void fetchFeed();
    } catch (error) {
      console.error("Preview failed:", error);
      setModalMessage("Unable to open the PDF preview.");
    }
  }

  async function downloadQuiz(quiz: QuizSetRecord, paymentConfirmed = false) {
    try {
      if (typeof window === "undefined") return;
      if (!currentUserId) {
        setModalMessage("Please log in to download quiz packs.");
        return;
      }
      setBusyQuizId(quiz.id);
      const isOwner = currentUserId === quiz.uploaderId || isSameEmail(currentUserEmail, quiz.uploader.email);
      if (!isOwner && quiz.price > 0 && !paymentConfirmed) {
        setCheckoutQuiz(quiz);
        return;
      }
      if (!isOwner && !downloadedRegistry.current.has(quiz.id)) {
        downloadedRegistry.current.add(quiz.id);
        const response = await fetch("/api/auth/quiz-download-increment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId: quiz.id }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error("Download metric update failed.");
        updateQuizCounters(quiz.id, { downloadCount: Number(data.downloadCount || quiz.downloadCount) });
        publishLiveEvent("download", quiz.id);
      }
      rememberInteraction(quiz.id);
      const { url, revoke } = payloadToBlobUrl(quiz.fileUrl, quiz.fileType);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFilename(quiz.title)}.${quiz.fileType === "PPTX" ? "pptx" : "pdf"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(revoke, 1500);
      onActionExecuted();
      void fetchFeed();
    } catch (error) {
      console.error("Download failed:", error);
      setModalMessage("Unable to download this pack right now.");
    } finally {
      setBusyQuizId(null);
    }
  }

  async function toggleDispute(quiz: QuizSetRecord) {
    if (!currentUserId) {
      setModalMessage("Please log in to flag copied content.");
      return;
    }
    try {
      setBusyQuizId(quiz.id);
      const response = await fetch("/api/quizzes/flag-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Flag update failed.");
      publishLiveEvent("dispute", quiz.id);
      await fetchFeed();
      onActionExecuted();
    } catch (error) {
      console.error("Dispute toggle failed:", error);
      setModalMessage("Unable to update the dispute flag.");
    } finally {
      setBusyQuizId(null);
    }
  }

  async function submitReview(quiz: QuizSetRecord) {
    if (!currentUserId) {
      setModalMessage("Please log in to review this pack.");
      return;
    }
    const isOwner = currentUserId === quiz.uploaderId || isSameEmail(currentUserEmail, quiz.uploader.email);
    if (isOwner) return;
    try {
      setBusyQuizId(quiz.id);
      const response = await fetch("/api/quizzes/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, score: scoreInput, reviewText: reviewInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Review failed.");
      setReviewInput("");
      setScoreInput(5);
      publishLiveEvent("review", quiz.id);
      await fetchFeed();
    } catch (error) {
      console.error("Review submission failed:", error);
      setModalMessage("Unable to submit your review.");
    } finally {
      setBusyQuizId(null);
    }
  }

  async function deleteQuiz(quiz: QuizSetRecord) {
    const isOwner = currentUserId === quiz.uploaderId || isSameEmail(currentUserEmail, quiz.uploader.email);
    if (!isOwner) return;
    try {
      setBusyQuizId(quiz.id);
      const response = await fetch("/api/quizzes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) throw new Error(data?.error || "Delete failed.");
      setQuizzes((current) => current.filter((item) => item.id !== quiz.id));
      publishLiveEvent("delete", quiz.id);
      await fetchFeed();
      onActionExecuted();
    } catch (error) {
      console.error("Delete failed:", error);
      setModalMessage("Unable to delete this pack.");
    } finally {
      setBusyQuizId(null);
    }
  }

  function slideShelf(direction: "left" | "right") {
    const shelf = shelfRef.current;
    if (!shelf) return;
    shelf.scrollBy({
      left: direction === "left" ? -420 : 420,
      behavior: "smooth",
    });
  }

  function handleShelfWheel(event: WheelEvent<HTMLDivElement>) {
    const shelf = shelfRef.current;
    if (!shelf) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const canMoveLeft = shelf.scrollLeft > 0;
    const canMoveRight = shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 2;
    const wantsLeft = event.deltaY < 0;
    const wantsRight = event.deltaY > 0;
    if ((wantsLeft && !canMoveLeft) || (wantsRight && !canMoveRight)) return;
    event.preventDefault();
    shelf.scrollBy({ left: event.deltaY, behavior: "auto" });
  }

  if (loading) {
    return (
      <div className="py-32 text-center text-sm font-black uppercase tracking-[0.28em] text-orange-300">
        Loading discovery shelf...
      </div>
    );
  }

  return (
    <section className="relative w-full translate-x-2 space-y-6 pr-2">
      <div className="relative overflow-hidden rounded-[26px] border border-orange-300/35 bg-orange-500/[0.06] p-4 shadow-[0_0_0_1px_rgba(251,146,60,0.12),0_22px_70px_rgba(2,6,23,0.24)] backdrop-blur-2xl">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent" />
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-orange-100">
              <Radio className="h-3.5 w-3.5" />
              Trending Circuit Feeds
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl xl:text-7xl">
              Discovery Shelf
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Vertical pack cards with live thumbnails, owner controls, and instant peer feedback.
            </p>
          </div>
          <Link
            href="/explore"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-300/30 bg-orange-300/10 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-orange-100 shadow-[0_0_28px_rgba(251,146,60,0.12)] backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:bg-orange-300/20 hover:shadow-[0_0_42px_rgba(251,146,60,0.24)]"
          >
            View More Discovery Archives
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
          <Search className="h-4 w-4 text-orange-200" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, creator, genre, campus..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">
            Live Set Rail
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Scroll sideways or use the controls when multiple sets are uploaded.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => slideShelf("left")}
            className="rounded-2xl border border-orange-300/25 bg-orange-300/10 p-3 text-orange-100 transition hover:scale-[1.01] hover:bg-orange-300/20"
            aria-label="Slide sets left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => slideShelf("right")}
            className="rounded-2xl border border-orange-300/25 bg-orange-300/10 p-3 text-orange-100 transition hover:scale-[1.01] hover:bg-orange-300/20"
            aria-label="Slide sets right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={shelfRef}
        onWheel={handleShelfWheel}
        className="custom-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden px-1 pb-5 pr-8"
      >
        {filteredQuizzes.map((quiz, index) => {
          const isOwner = currentUserId === quiz.uploaderId || isSameEmail(currentUserEmail, quiz.uploader.email);
          const expanded = expandedQuiz === quiz.id;
          const score = averageScoreByQuiz[quiz.id] || 0;

          return (
            <motion.article
              key={quiz.id}
              initial={{ opacity: 0, y: 28, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
              layout
              className="group relative w-[min(520px,calc(100vw-3rem))] shrink-0 snap-start overflow-hidden rounded-[26px] border border-orange-400/70 bg-orange-500/10 p-1.5 text-white shadow-[0_0_0_2px_rgba(251,146,60,0.16),0_18px_70px_rgba(251,146,60,0.12)] transition duration-300 hover:scale-[1.01] hover:border-orange-300/90 md:w-[540px]"
            >
              <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-orange-200/25" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />
              <div className="relative overflow-hidden rounded-[22px] border border-orange-200/25 bg-[#08080d]">
                <button
                  type="button"
                  onClick={() => openPreview(quiz)}
                  className="relative block w-full p-2.5 text-left"
                  aria-label={`Preview ${quiz.title}`}
                >
                  <PdfCover quiz={quiz} />
                  {index < 3 && (
                    <div className="absolute right-6 top-6 rounded-full bg-orange-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-orange-500/30">
                      Hot
                    </div>
                  )}
                </button>

                  <div className="space-y-4 p-4 md:p-5">
                  <div className="flex flex-wrap gap-2">
                    <Pill>{quiz.genre || "GENERAL"}</Pill>
                    <Pill slate>{campusBadge(quiz.uploader)}</Pill>
                    {quiz.isPlagiarized ? (
                      <Pill danger>
                        <AlertTriangle size={13} /> Content Dispute Flagged
                      </Pill>
                    ) : (
                      <Pill ok>
                        <CheckCircle2 size={13} /> Verified Original
                      </Pill>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => openPreview(quiz)}
                      className="block text-left text-2xl font-black leading-tight tracking-tight text-white transition hover:scale-[1.01] hover:text-orange-200 md:text-3xl"
                    >
                      {quiz.title}
                    </button>
                    <Link
                      href={`/profile/${quiz.uploaderId}`}
                      className="inline-flex text-sm font-bold text-slate-400 transition hover:scale-[1.01] hover:text-orange-200"
                    >
                      Uploaded by @{creatorHandle(quiz.uploader?.name || "creator")}
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-white/10 bg-white/[0.035] p-3 md:grid-cols-4">
                    <Metric label="Questions" value={quiz.questionCount} />
                    <Metric label="Views" value={quiz.uniqueViews} />
                    <Metric label="Downloads" value={quiz.downloadCount} />
                    <Metric label="Price" value={quiz.price === 0 ? "Free" : `Rs ${quiz.price}`} />
                  </div>

                  <div className="flex flex-col gap-3 border-y border-white/10 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400">
                      <Star size={17} className="fill-amber-400 text-amber-400" />
                      {score ? `${score.toFixed(1)} average rating` : "No ratings yet"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedQuiz(expanded ? null : quiz.id)}
                      className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-400 transition hover:scale-[1.01] hover:text-white"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      Reviews ({quiz.ratings?.length || 0})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ActionButton onClick={() => openPreview(quiz)} icon={<Eye size={16} />} label="Preview" />
                    <ActionButton
                      onClick={() => downloadQuiz(quiz)}
                      icon={<Download size={16} />}
                      label="Download"
                      disabled={busyQuizId === quiz.id}
                      strong
                    />
                    <ActionButton
                      onClick={() => toggleDispute(quiz)}
                      icon={<Flag size={16} />}
                      label={quiz.isPlagiarized ? "Clear Flag" : "Flag Copy"}
                      disabled={busyQuizId === quiz.id}
                      amber
                    />
                    {isOwner && (
                      <ActionButton
                        onClick={() => deleteQuiz(quiz)}
                        icon={<Trash2 size={16} />}
                        label="Delete"
                        disabled={busyQuizId === quiz.id}
                        danger
                      />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="custom-scrollbar max-h-[560px] overflow-y-auto border-t border-orange-200/20 bg-[#0b0b10]"
                    >
                      <div className="space-y-4 p-4 md:p-5">
                        <div className="rounded-[24px] border border-orange-300/20 bg-orange-300/10 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-black text-white">Live Review Room</h3>
                            <p className="text-sm font-semibold text-slate-400">
                              Reviews sync across open tabs as soon as they are posted.
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                            Live
                          </span>
                        </div>
                        </div>
                        {isOwner && (
                          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-semibold text-amber-100">
                            <LockKeyhole className="h-4 w-4 shrink-0" />
                            Review interface locked. You cannot submit feedback notes on your own published content sets.
                          </div>
                        )}
                        {!isOwner && currentUserId && (
                          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5].map((scoreOption) => (
                                <button
                                  key={scoreOption}
                                  type="button"
                                  onClick={() => setScoreInput(scoreOption)}
                                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-black transition hover:scale-[1.01] ${
                                    scoreInput >= scoreOption
                                      ? "border-amber-300/40 bg-amber-300/15 text-amber-100"
                                      : "border-white/10 bg-white/[0.04] text-slate-400"
                                  }`}
                                >
                                  <Star className={`h-3.5 w-3.5 ${scoreInput >= scoreOption ? "fill-amber-300 text-amber-300" : ""}`} />
                                  {scoreOption}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={reviewInput}
                              onChange={(event) => setReviewInput(event.target.value)}
                              placeholder="Write a useful peer review..."
                              className="min-h-[96px] resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-300/50"
                            />
                            <button
                              type="button"
                              disabled={busyQuizId === quiz.id}
                              onClick={() => submitReview(quiz)}
                              className="rounded-2xl bg-orange-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:scale-[1.01] hover:bg-orange-600 disabled:opacity-50"
                            >
                              Send Review
                            </button>
                          </div>
                        )}
                        <div className="grid gap-3">
                          {quiz.ratings?.length ? (
                            quiz.ratings.map((rating) => (
                              <div key={rating.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                    Verified Peer Note
                                  </span>
                                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">
                                    {rating.score}/5
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-300">
                                  {rating.reviewText || "No written feedback."}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-3xl border border-dashed border-orange-300/20 bg-orange-300/[0.04] p-8 text-center text-sm font-semibold text-slate-400">
                              No reviews yet. The first verified peer note will appear here instantly.
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>
          );
        })}
      </div>

      <AnimatePresence>
        {previewQuiz && <PdfPreviewModal quiz={previewQuiz} onClose={() => setPreviewQuiz(null)} />}

        {checkoutQuiz && (
          <CheckoutModal
            quiz={checkoutQuiz}
            onClose={() => setCheckoutQuiz(null)}
            onConfirm={() => {
              const nextQuiz = checkoutQuiz;
              setCheckoutQuiz(null);
              void downloadQuiz(nextQuiz, true);
            }}
          />
        )}

        {modalMessage && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              className="w-full max-w-lg rounded-[28px] border border-orange-200/30 bg-white p-6 text-slate-950 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
                <h3 className="text-xl font-black">Action Notice</h3>
                <button
                  type="button"
                  onClick={() => setModalMessage(null)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{modalMessage}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Pill({
  children,
  slate,
  ok,
  danger,
}: {
  children: ReactNode;
  slate?: boolean;
  ok?: boolean;
  danger?: boolean;
}) {
  const tone = danger
    ? "border-red-200 bg-red-50 text-red-700"
    : ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : slate
        ? "border-slate-200 bg-slate-100 text-slate-700"
        : "border-orange-200 bg-orange-50 text-orange-700";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition hover:scale-[1.01] ${tone}`}
    >
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3 text-center shadow-sm">
      <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-xl font-black text-white">{value}</div>
    </div>
  );
}

function CheckoutModal({
  quiz,
  onClose,
  onConfirm,
}: {
  quiz: QuizSetRecord;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        className="w-full max-w-md rounded-[28px] border border-orange-200/20 bg-[#08080d] p-6 text-white shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">Payment Required</p>
            <h3 className="mt-2 text-2xl font-black">{quiz.title}</h3>
            <p className="mt-1 text-sm text-slate-400">Access price: Rs {quiz.price}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input placeholder="UPI ID" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none focus:border-orange-300/50" />
          <input placeholder="Card number" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none focus:border-orange-300/50" />
          <input placeholder="MM / YY   CVC" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none focus:border-orange-300/50" />
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-2xl bg-orange-500 px-4 py-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:scale-[1.01] hover:bg-orange-600"
        >
          Pay and Download Pack
        </button>
      </motion.div>
    </motion.div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  strong = false,
  amber = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
  amber?: boolean;
  danger?: boolean;
}) {
  const className = danger
    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : amber
      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
      : strong
        ? "border-slate-950 bg-slate-950 text-white hover:bg-orange-600 hover:border-orange-600"
        : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-50 ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
