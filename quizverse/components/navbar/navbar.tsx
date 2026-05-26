"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  Camera,
  Globe,
  Moon,
  Search,
  Star,
  Sun,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import AuthModal from "../auth/AuthModal";

type LanguageMode = "en" | "hi";
type ThemeMode = "dark" | "light";
type PositionMode =
  | "Coordinator"
  | "Design Head"
  | "Event Head"
  | "Quizzing Head"
  | "Ex Coordinator"
  | "Ex Design Head"
  | "Ex Event Head"
  | "Ex Quizzing Head"
  | "Member";

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  isPremium?: boolean;
  profile?: {
    institutionName?: string | null;
    contributions?: number | null;
  } | null;
}

interface QuizSetSummary {
  id: string;
  title: string;
  uniqueViews: number;
  downloadCount: number;
  price: number;
  uploaderId: string;
  uploader: {
    email?: string;
    name: string;
  };
}

const positions: PositionMode[] = [
  "Coordinator",
  "Design Head",
  "Event Head",
  "Quizzing Head",
  "Ex Coordinator",
  "Ex Design Head",
  "Ex Event Head",
  "Ex Quizzing Head",
  "Member",
];

function inferInstitution(email?: string, profileInstitution?: string | null) {
  const lowered = email?.toLowerCase() || "";
  if (lowered.endsWith("@iitism.ac.in")) return "IIT (ISM) DHANBAD";
  if (lowered.endsWith("@iitb.ac.in")) return "IIT BOMBAY";
  return profileInstitution || "College Student Network";
}

function sameCollegePeople(institution: string) {
  if (/bombay/i.test(institution)) {
    return ["Aarav Mehta - Quiz Club", "Ira Shah - Design Cell", "Kabir Rao - Events"];
  }
  if (/dhanbad|ism/i.test(institution)) {
    return ["Sarthak Jain - Quiz Club", "Saharsh Gupta - Events", "Ananya Roy - Design Cell"];
  }
  return ["Campus Quiz Lead", "Design Society Member", "Event Operations Lead"];
}

export default function Navbar() {
  const [language, setLanguage] = useState<LanguageMode>("en");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [position, setPosition] = useState<PositionMode>("Member");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [quizzes, setQuizzes] = useState<QuizSetSummary[]>([]);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("omniquiz_lang") === "hi" ? "hi" : "en";
    const storedTheme = window.localStorage.getItem("omniquiz_theme") === "light" ? "light" : "dark";
    const storedPosition = window.localStorage.getItem("omniquiz_profile_position") as PositionMode | null;
    const storedPhoto = window.localStorage.getItem("omniquiz_profile_photo") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setLanguage(storedLanguage);
    setTheme(storedTheme);
    if (storedPosition && positions.includes(storedPosition)) setPosition(storedPosition);
    setProfilePhoto(storedPhoto);
    document.documentElement.dataset.theme = storedTheme;

    async function hydrateProfile() {
      try {
        const [meResponse, quizResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/quizzes/trending", { cache: "no-store" }),
        ]);
        const me = await meResponse.json().catch(() => null);
        const feed = await quizResponse.json().catch(() => null);
        if (me?.success && me.user) setUser(me.user as ProfileUser);
        if (feed?.success) setQuizzes(feed.quizzes as QuizSetSummary[]);
      } catch {
        const cachedUser = window.localStorage.getItem("omniquiz_user");
        if (cachedUser) setUser(JSON.parse(cachedUser) as ProfileUser);
      }
    }
    void hydrateProfile();
  }, []);

  const institution = inferInstitution(user?.email, user?.profile?.institutionName);
  const myQuizzes = useMemo(() => {
    if (!user) return [];
    return quizzes.filter((quiz) => quiz.uploaderId === user.id || quiz.uploader.email === user.email);
  }, [quizzes, user]);
  const revenue = myQuizzes.reduce((total, quiz) => total + quiz.price * quiz.downloadCount, 0);
  const bestPost = [...myQuizzes].sort(
    (left, right) => right.uniqueViews + right.downloadCount - (left.uniqueViews + left.downloadCount),
  )[0];
  const recommendations = sameCollegePeople(institution).filter((person) =>
    person.toLowerCase().includes(userSearch.toLowerCase()),
  );
  const completionItems = [Boolean(user?.name), Boolean(user?.email), Boolean(institution), Boolean(position), Boolean(profilePhoto)];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  function toggleLanguage() {
    const next = language === "en" ? "hi" : "en";
    setLanguage(next);
    window.localStorage.setItem("omniquiz_lang", next);
    window.dispatchEvent(new CustomEvent("omniquiz-language", { detail: { value: next } }));
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("omniquiz_theme", next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new CustomEvent("omniquiz-theme", { detail: { value: next } }));
  }

  function updatePosition(next: PositionMode) {
    setPosition(next);
    window.localStorage.setItem("omniquiz_profile_position", next);
    setSavedMessage("");
  }

  function updateProfilePhoto(value: string) {
    setProfilePhoto(value);
    window.localStorage.setItem("omniquiz_profile_photo", value);
    setSavedMessage("");
  }

  function saveProfileDraft() {
    window.localStorage.setItem(
      "omniquiz_profile_draft",
      JSON.stringify({ position, profilePhoto, institution, updatedAt: new Date().toISOString() }),
    );
    setSavedMessage("Profile draft saved on this device.");
  }

  function focusStudio() {
    document.getElementById("creator-studio-runway")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl transition data-[theme=light]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="shrink-0 text-2xl font-black tracking-tight text-white">
          Omni<span className="text-orange-300">Quiz</span>
        </div>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
            Campus Curation Workspace
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-orange-200/25 bg-orange-300/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-orange-100 transition hover:scale-[1.01] hover:bg-orange-300/20"
          >
            <UserRound size={16} />
            Complete Profile
          </button>
          <button
            onClick={toggleLanguage}
            className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:scale-[1.01] hover:bg-white/10 sm:flex"
          >
            <Globe size={16} />
            {language.toUpperCase()}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white transition hover:scale-[1.01] hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={focusStudio}
            className="hidden items-center gap-2 rounded-2xl bg-orange-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:scale-[1.01] hover:bg-orange-200 md:flex"
          >
            <Upload size={16} />
            Upload
          </button>
          <AuthModal />
        </div>
      </div>

    </nav>

      {mounted && createPortal(
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            className="fixed inset-0 z-[1000] flex justify-end bg-slate-950/70 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              initial={{ x: 36, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 36, opacity: 0 }}
              className="custom-scrollbar h-full w-full max-w-xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                    College Student Profile
                  </p>
                  <h2 className="mt-1 text-3xl font-black">Complete Profile</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100"
                  aria-label="Close profile"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white">
                      {profilePhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-7 w-7 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black">{user?.name || "Logged-out student"}</h3>
                      <p className="truncate text-sm font-semibold text-slate-500">
                        {user?.email || "Log in to auto-fill college details"}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-orange-600">
                        {institution}
                      </p>
                    </div>
                  </div>
                  <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Profile picture URL
                  </label>
                  <input
                    value={profilePhoto}
                    onChange={(event) => updateProfilePhoto(event.target.value)}
                    placeholder="Paste image URL for now"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300"
                  />
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      <span>Profile completion</span>
                      <span className="text-orange-600">{completion}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-violet-500 transition-all duration-500"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-orange-600" />
                    <h3 className="font-black">Position of Responsibility</h3>
                  </div>
                  <select
                    value={position}
                    onChange={(event) => updatePosition(event.target.value as PositionMode)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-300"
                  >
                    {positions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                    Coordinator slots are capped at 2 per college when the backend connection is added.
                  </p>
                  {position === "Coordinator" && (
                    <button
                      type="button"
                      className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:scale-[1.01] hover:bg-orange-600"
                    >
                      Hire QM
                    </button>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-black">Autofilled College Identity</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ReadonlyField label="Name" value={user?.name || "Login required"} />
                    <ReadonlyField label="Email" value={user?.email || "Login required"} />
                    <ReadonlyField label="College" value={institution} />
                    <ReadonlyField label="Account Type" value={user ? "College Student" : "Guest"} />
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-3">
                  <ProfileMetric icon={<BarChart3 />} label="Generated Revenue" value={`Rs ${Math.round(revenue * 0.7)}`} />
                  <ProfileMetric icon={<Upload />} label="Posts" value={myQuizzes.length} />
                  <ProfileMetric icon={<Star />} label="Best Post" value={bestPost?.title || "No posts"} />
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <h3 className="font-black">Find People From Your College</h3>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search user, club, or role"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {recommendations.map((person) => (
                      <div
                        key={person}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <span className="text-sm font-bold text-slate-700">{person}</span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:scale-[1.01]"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">
                    Public profile preview
                  </p>
                  <h3 className="mt-2 text-2xl font-black">{user?.name || "Student profile"}</h3>
                  <p className="mt-1 text-sm text-slate-400">{institution} - {position}</p>
                  <div className="mt-4 grid gap-2">
                    {myQuizzes.slice(0, 3).map((quiz) => (
                      <div key={quiz.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="truncate text-sm font-bold">{quiz.title}</p>
                        <p className="text-xs text-slate-400">
                          {quiz.uniqueViews} views - {quiz.downloadCount} downloads
                        </p>
                      </div>
                    ))}
                    {!myQuizzes.length && (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-400">
                        Uploaded sets will appear here when this profile publishes.
                      </div>
                    )}
                  </div>
                </section>

                <div className="sticky bottom-0 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={saveProfileDraft}
                    className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:scale-[1.01] hover:bg-orange-600"
                  >
                    Save Profile Draft
                  </button>
                  {savedMessage && (
                    <p className="mt-2 text-center text-xs font-bold text-emerald-600">{savedMessage}</p>
                  )}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
