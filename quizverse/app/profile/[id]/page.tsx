"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, Download, Eye, Star, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import Navbar from "@/components/navbar/navbar";

interface RatingRecord {
  id: string;
  score: number;
}

interface QuizSetRecord {
  id: string;
  title: string;
  genre: string;
  questionCount: number;
  uniqueViews: number;
  downloadCount: number;
  price: number;
  uploaderId: string;
  uploader: {
    id: string;
    name: string;
    email?: string;
    profile?: {
      institutionName?: string | null;
    } | null;
  };
  ratings: RatingRecord[];
}

function campusLabel(email?: string, institution?: string | null) {
  const lowered = email?.toLowerCase() || "";
  if (lowered.endsWith("@iitism.ac.in")) return "IIT (ISM) DHANBAD";
  if (lowered.endsWith("@iitb.ac.in")) return "IIT BOMBAY";
  return institution || "Campus Network";
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const [profileId, setProfileId] = useState("");
  const [quizzes, setQuizzes] = useState<QuizSetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      setProfileId(params.id);
      try {
        const response = await fetch("/api/quizzes/trending", { cache: "no-store" });
        const data = await response.json();
        if (data?.success) setQuizzes(data.quizzes as QuizSetRecord[]);
      } finally {
        setLoading(false);
      }
    }
    void hydrate();
  }, [params.id]);

  const uploaded = useMemo(
    () => quizzes.filter((quiz) => quiz.uploaderId === profileId || quiz.uploader.id === profileId),
    [profileId, quizzes],
  );
  const owner = uploaded[0]?.uploader;
  const totalViews = uploaded.reduce((total, quiz) => total + quiz.uniqueViews, 0);
  const totalDownloads = uploaded.reduce((total, quiz) => total + quiz.downloadCount, 0);
  const revenue = uploaded.reduce((total, quiz) => total + quiz.price * quiz.downloadCount, 0);
  const averageRating = uploaded.flatMap((quiz) => quiz.ratings).length
    ? uploaded.flatMap((quiz) => quiz.ratings).reduce((total, rating) => total + rating.score, 0) /
      uploaded.flatMap((quiz) => quiz.ratings).length
    : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(251,146,60,0.14),transparent_34%),linear-gradient(180deg,#0f172a,#020617)] text-white">
      <Navbar />
      <section className="mx-auto max-w-6xl px-5 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300 transition hover:scale-[1.01] hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shelf
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[34px] border border-orange-200/20 bg-white p-2 text-slate-950 shadow-2xl"
        >
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-7 md:p-10">
            {loading ? (
              <div className="py-20 text-center text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                Loading profile...
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-100 text-3xl font-black text-orange-700">
                      {(owner?.name || "U").slice(0, 1)}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                      Public Creator Profile
                    </p>
                    <h1 className="mt-2 text-5xl font-black tracking-tight">{owner?.name || "Creator"}</h1>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {owner?.email || "No email available"} - {campusLabel(owner?.email, owner?.profile?.institutionName)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <ProfileMetric icon={<Upload />} label="Posts" value={uploaded.length} />
                    <ProfileMetric icon={<Eye />} label="Views" value={totalViews} />
                    <ProfileMetric icon={<Download />} label="Downloads" value={totalDownloads} />
                    <ProfileMetric icon={<Star />} label="Rating" value={averageRating ? averageRating.toFixed(1) : "New"} />
                  </div>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="mb-5 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-600" />
                    <h2 className="text-xl font-black">Uploaded Sets</h2>
                    <span className="ml-auto rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                      Net revenue Rs {Math.round(revenue * 0.7)}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {uploaded.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <p className="text-lg font-black">{quiz.title}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {quiz.genre} - {quiz.questionCount} questions
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-black text-slate-600">
                          <span className="rounded-full bg-white px-3 py-2">{quiz.uniqueViews} views</span>
                          <span className="rounded-full bg-white px-3 py-2">{quiz.downloadCount} downloads</span>
                          <span className="rounded-full bg-white px-3 py-2">{quiz.price === 0 ? "Free" : `Rs ${quiz.price}`}</span>
                        </div>
                      </div>
                    ))}
                    {!uploaded.length && (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
                        No uploaded sets found for this profile.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </section>
    </main>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-orange-600">{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 max-w-28 truncate text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}
