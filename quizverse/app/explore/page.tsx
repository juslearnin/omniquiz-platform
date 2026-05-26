"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  CreditCard,
  Crown,
  Eye,
  Flame,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/navbar/navbar";

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

type ExplorePdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: string | { data: Uint8Array }) => {
    promise: Promise<{
      getPage: (pageNumber: number) => Promise<{
        getViewport: (options: { scale: number }) => { width: number; height: number };
        render: (options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
};

type LanguageMode = "en" | "hi";
type PricingFilter = "all" | "free" | "premium";
type VolumeFilter = "all" | "small" | "medium" | "large";

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
}

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  isPremium: boolean;
  profile?: {
    institutionName?: string | null;
  } | null;
}

const languageCopy = {
  en: {
    title: "Explore Discovery Archives",
    subtitle: "Search, filter, and carousel through cross-campus curation packets.",
    search: "Search title, creator, metadata, campus...",
    hot: "Hot Recently Uploaded",
    recent: "Recently Viewed Encounters",
    curated: "Exclusively Curated For You",
    emptyRecent: "Your local trail is empty, so high-signal trivia is filling this shelf.",
    pass: "Unlock Unlimited Access Pass",
    passBody:
      "Upgrade to the Premium Circuit Pass Tier right now to bypass the rolling daily 5-views gate limit, claim exclusive commercial combo pack bundles, and secure a global standing star badge layout upgrade across your campus network nodes.",
    claim: "Claim Pass Ticket",
  },
  hi: {
    title: "डिस्कवरी अभिलेख एक्सप्लोर",
    subtitle: "कैंपस क्यूरेशन पैकेट खोजें, फ़िल्टर करें और कैरोसेल में देखें।",
    search: "शीर्षक, निर्माता, मेटाडेटा, कैंपस खोजें...",
    hot: "हाल ही में अपलोडेड हॉट सेट",
    recent: "हाल ही में देखे गए एन्काउंटर",
    curated: "आपके लिए विशेष क्यूरेशन",
    emptyRecent: "आपका लोकल ट्रेल खाली है, इसलिए हाई-सिग्नल ट्रिविया दिखाया गया है।",
    pass: "अनलिमिटेड एक्सेस पास अनलॉक करें",
    passBody:
      "प्रीमियम सर्किट पास से 5-व्यू सीमा हटाएं, कॉम्बो पैक पाएं और ग्लोबल कैंपस बैज अपग्रेड करें।",
    claim: "पास टिकट लें",
  },
} satisfies Record<LanguageMode, Record<string, string>>;

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function campusBadge(uploader: QuizUploader) {
  const email = uploader.email?.toLowerCase() || "";
  const institution = uploader.profile?.institutionName || "";
  if (email.endsWith("@iitism.ac.in") || /ism|dhanbad/i.test(institution)) return "IIT (ISM) DHANBAD";
  if (email.endsWith("@iitb.ac.in") || /bombay/i.test(institution)) return "IIT BOMBAY";
  return institution || "GLOBAL CAMPUS";
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

async function loadPdfJs() {
  if (typeof window === "undefined") throw new Error("PDF rendering is browser-only.");
  const pdfWindow = window as Window & { pdfjsLib?: ExplorePdfJsLib };
  if (pdfWindow.pdfjsLib) {
    pdfWindow.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return pdfWindow.pdfjsLib;
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

  const pdfjs = (window as Window & { pdfjsLib?: ExplorePdfJsLib }).pdfjsLib as ExplorePdfJsLib | undefined;
  if (!pdfjs) throw new Error("PDF.js did not attach to window.");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return pdfjs;
}

function passesVolume(quiz: QuizSetRecord, filter: VolumeFilter) {
  if (filter === "small") return quiz.questionCount < 25;
  if (filter === "medium") return quiz.questionCount >= 25 && quiz.questionCount <= 50;
  if (filter === "large") return quiz.questionCount > 50;
  return true;
}

function passesPricing(quiz: QuizSetRecord, filter: PricingFilter) {
  if (filter === "free") return quiz.price === 0;
  if (filter === "premium") return quiz.price > 0;
  return true;
}

export default function ExplorePage() {
  const [quizzes, setQuizzes] = useState<QuizSetRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<LanguageMode>("en");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>("all");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const t = languageCopy[language];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previousBackground = document.body.style.background;
    document.body.style.background =
      "linear-gradient(180deg, #0b0714 0%, #060511 46%, #040409 100%)";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(window.localStorage.getItem("omniquiz_lang") === "hi" ? "hi" : "en");
    setRecentIds(readLocalJson<string[]>("omniquiz_recent_quiz_ids", []));

    async function fetchExploreData() {
      try {
        const [feedResponse, sessionResponse] = await Promise.all([
          fetch("/api/quizzes/trending", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }).catch(() => null),
        ]);
        const feedData = await feedResponse.json();
        if (feedData?.success) setQuizzes(feedData.quizzes as QuizSetRecord[]);
        if (sessionResponse?.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData?.success && sessionData.user) setCurrentUser(sessionData.user as CurrentUser);
        }
      } catch (error) {
        console.error("Explore feed failed:", error);
      }
    }

    void fetchExploreData();
    return () => {
      document.body.style.background = previousBackground;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      const corpus = [
        quiz.title,
        quiz.genre,
        quiz.description || "",
        quiz.uploader?.name || "",
        quiz.uploader?.email || "",
        campusBadge(quiz.uploader),
      ]
        .join(" ")
        .toLowerCase();
      return (!needle || corpus.includes(needle)) && passesPricing(quiz, pricingFilter) && passesVolume(quiz, volumeFilter);
    });
  }, [pricingFilter, query, quizzes, volumeFilter]);

  const hotRecentlyUploaded = useMemo(
    () => [...filtered].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [filtered],
  );
  const recentlyViewed = useMemo(() => {
    const trail = recentIds
      .map((id) => filtered.find((quiz) => quiz.id === id))
      .filter((quiz): quiz is QuizSetRecord => Boolean(quiz));
    return trail.length ? trail : filtered.filter((quiz) => quiz.price === 0).slice(0, 8);
  }, [filtered, recentIds]);
  const curated = useMemo(() => {
    const userCorpus = `${currentUser?.email || ""} ${currentUser?.role || ""} ${currentUser?.profile?.institutionName || ""}`.toLowerCase();
    if (userCorpus.includes("iitb") || userCorpus.includes("college_student")) {
      return filtered.filter((quiz) => /mela|tlc|general/i.test(quiz.genre)).slice(0, 10);
    }
    return filtered.slice(0, 10);
  }, [currentUser, filtered]);

  function handleLanguageChange(nextLanguage: LanguageMode) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("omniquiz_lang", nextLanguage);
    window.dispatchEvent(new CustomEvent("omniquiz-language", { detail: { value: nextLanguage } }));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#0b0714_0%,#060511_46%,#040409_100%)] text-white selection:bg-purple-500/30">
      <Navbar />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(147,51,234,0.16),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(34,211,238,0.12),transparent_24%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 md:px-12"
      >
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-300 transition hover:scale-[1.01] hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <header className="space-y-8 text-center">
          <div>
            <div className="mx-auto mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-purple-200">
              Elite Discovery Environment
            </div>
            <h1 className="text-5xl font-black uppercase tracking-tight text-white md:text-7xl">
              {t.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-zinc-400">
              {t.subtitle}
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-4xl flex-col items-stretch gap-4 rounded-[32px] border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-2xl md:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <Search className="h-4 w-4 text-purple-200" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value === "hi" ? "hi" : "en")}
              className="rounded-2xl border border-white/10 bg-[#120d1f] px-4 py-3 text-sm font-bold text-white outline-none"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
            <select
              value={pricingFilter}
              onChange={(event) => setPricingFilter(event.target.value as PricingFilter)}
              className="rounded-2xl border border-white/10 bg-[#120d1f] px-4 py-3 text-sm font-bold text-white outline-none"
            >
              <option value="all">All Pricing</option>
              <option value="free">Free Access Sets Only</option>
              <option value="premium">Premium Bundles</option>
            </select>
            <select
              value={volumeFilter}
              onChange={(event) => setVolumeFilter(event.target.value as VolumeFilter)}
              className="rounded-2xl border border-white/10 bg-[#120d1f] px-4 py-3 text-sm font-bold text-white outline-none"
            >
              <option value="all">All Volumes</option>
              <option value="small">&lt; 25 Qs</option>
              <option value="medium">25 - 50 Qs</option>
              <option value="large">50+ Qs</option>
            </select>
          </div>
        </header>

        <div className="mt-14 space-y-12">
          <CarouselShelf icon={<Flame className="h-5 w-5 text-amber-300" />} title={t.hot} quizzes={hotRecentlyUploaded} accent="amber" />
          <CarouselShelf
            icon={<Eye className="h-5 w-5 text-blue-300" />}
            title={t.recent}
            quizzes={recentlyViewed}
            accent="blue"
            note={!recentIds.length ? t.emptyRecent : undefined}
          />
          <section className="rounded-[36px] border border-white/10 bg-white/[0.025] p-5 backdrop-blur-2xl md:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-full border border-purple-400/25 bg-purple-400/10 p-3">
                <Sparkles className="h-5 w-5 text-purple-200" />
              </span>
              <h2 className="text-xl font-black uppercase tracking-[0.18em] text-white">{t.curated}</h2>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-4">
              {curated.map((quiz, index) => (
                <ExploreCard key={quiz.id} quiz={quiz} index={index} />
              ))}
              <div className="flex min-h-[320px] w-[360px] shrink-0 select-none flex-col justify-between rounded-[36px] border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-indigo-950/20 to-black/80 p-8 text-center shadow-[0_0_50px_rgba(147,51,234,0.05)]">
                <Crown className="mx-auto h-10 w-10 text-amber-200" />
                <div>
                  <h3 className="text-2xl font-black uppercase leading-tight text-white">{t.pass}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">{t.passBody}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(true)}
                  className="rounded-2xl bg-purple-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:scale-[1.01] hover:bg-purple-500"
                >
                  {t.claim}
                </button>
              </div>
            </div>
          </section>
        </div>
      </motion.div>

      <CheckoutDrawer open={checkoutOpen} onClose={() => setCheckoutOpen(false)} label={t.claim} />
    </main>
  );
}

function CarouselShelf({
  title,
  icon,
  quizzes,
  note,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  quizzes: QuizSetRecord[];
  note?: string;
  accent: "amber" | "blue";
}) {
  return (
    <section className="rounded-[36px] border border-white/10 bg-white/[0.025] p-5 backdrop-blur-2xl md:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border p-3 ${
              accent === "amber"
                ? "border-amber-300/25 bg-amber-300/10 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
                : "border-blue-300/25 bg-blue-300/10 shadow-[0_0_24px_rgba(96,165,250,0.12)]"
            }`}
          >
            {icon}
          </span>
          <h2 className="text-xl font-black uppercase tracking-[0.18em] text-white">{title}</h2>
        </div>
        {note && <p className="text-xs font-semibold text-zinc-500">{note}</p>}
      </div>
      <div className="group flex gap-5 overflow-x-auto pb-4">
        {quizzes.map((quiz, index) => (
          <ExploreCard key={quiz.id} quiz={quiz} index={index} />
        ))}
      </div>
    </section>
  );
}

function ExploreCard({ quiz, index }: { quiz: QuizSetRecord; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="w-[292px] shrink-0 rounded-[26px] border border-orange-400/45 bg-orange-500/10 p-1.5 shadow-[0_0_0_1px_rgba(251,146,60,0.12),0_16px_58px_rgba(251,146,60,0.10)] transition duration-300 hover:scale-[1.01] hover:border-orange-300/75 group-hover:blur-[1px] hover:!blur-none"
    >
      <div className="rounded-[22px] border border-orange-200/20 bg-[#050509] p-3">
        <ExplorePdfCover quiz={quiz} />
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-100">
            {quiz.genre}
          </span>
          <span className="text-xs font-black text-zinc-500">{quiz.price === 0 ? "Free access" : "Premium"}</span>
        </div>
        <h3 className="line-clamp-3 text-xl font-black leading-tight text-white">{quiz.title}</h3>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-200">{campusBadge(quiz.uploader)}</p>
        <p className="mt-2 text-sm text-zinc-500">Compiled by @{quiz.uploader.name.split(" ")[0]}</p>
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <MiniMetric label="Views" value={quiz.uniqueViews} />
          <MiniMetric label="Pulls" value={quiz.downloadCount} />
          <MiniMetric label="Qs" value={quiz.questionCount} />
        </div>
      </div>
    </motion.article>
  );
}

function ExplorePdfCover({ quiz }: { quiz: QuizSetRecord }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (typeof window === "undefined" || !canvasRef.current || quiz.fileType === "PPTX") return;
    let cancelled = false;
    async function renderCover() {
      try {
        setStatus("loading");
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const pdfjs = await loadPdfJs();
        const source = /^https?:\/\//i.test(quiz.fileUrl)
          ? quiz.fileUrl
          : { data: base64ToBytes(quiz.fileUrl) };
        const pdf = await pdfjs.getDocument(source).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.92 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }
    void renderCover();
    return () => {
      cancelled = true;
    };
  }, [quiz.fileType, quiz.fileUrl]);

  return (
    <div className="relative mb-4 flex h-36 items-center justify-center overflow-hidden rounded-2xl border border-orange-200/20 bg-white">
      <canvas
        ref={canvasRef}
        className={`h-full w-full object-cover transition duration-500 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {status !== "ready" && (
        <div className="absolute flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          Poster
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function CheckoutDrawer({
  open,
  onClose,
  label,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="ml-auto flex h-full w-full max-w-md flex-col justify-between border-l border-white/10 bg-[#08070d] p-6 shadow-2xl"
          >
            <div>
              <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-xl font-black uppercase text-white">Premium Checkout</h3>
                <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input placeholder="UPI ID" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
                <input placeholder="Card Number" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
                <input placeholder="MM / YY   CVC" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none" />
              </div>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white">
              <CreditCard className="h-4 w-4" />
              {label}
            </button>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
