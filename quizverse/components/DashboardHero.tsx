"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  name: string;
  role: string;
  profile?: {
    institutionName?: string | null;
    companyName?: string | null;
  } | null;
}

export default function DashboardHero() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [trivia, setTrivia] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, triviaRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/auth/trivia")
        ]);
        
        const meData = await meRes.json();
        const triviaData = await triviaRes.json();
        
        if (meData && meData.success && meData.user) {
          setUser(meData.user);
          localStorage.setItem("omniquiz_user", JSON.stringify(meData.user));
        } else {
          const cached = localStorage.getItem("omniquiz_user");
          if (cached) setUser(JSON.parse(cached));
        }

        if (triviaData?.fact) setTrivia(triviaData.fact);
        else if (triviaData?.trivia) setTrivia(triviaData.trivia);
      } catch (err) {
        console.error("Dashboard hydration error:", err);
        const cached = localStorage.getItem("omniquiz_user");
        if (cached) setUser(JSON.parse(cached));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !user) return null;

  // Resolves against our schema object mappings safely
  const displayContextName = user.profile?.institutionName || user.profile?.companyName || null;

  return (
    <section className="relative w-full overflow-hidden bg-black pb-20 pt-24">
      <div className="pointer-events-none absolute left-1/4 top-1/4 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-10 -z-10 h-[400px] w-[400px] rounded-full bg-cyan-600/5 blur-[100px]" />

      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-col gap-16 md:gap-24">
          
          <div className="space-y-6 max-w-4xl">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-500 block">
                Circuit Workspace
              </span>
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-white leading-none">
                Hey, <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">{user.name ? user.name.split(" ")[0] : "Quizzer"}</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              {displayContextName ? (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-purple-500/10 border border-purple-500/20 px-5 py-2.5 text-xs font-black text-purple-400 tracking-wider uppercase shadow-inner">
                  TL 🏛️ {displayContextName}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 px-5 py-2.5 text-xs font-black text-cyan-400 tracking-wider uppercase">
                  ⚡ {user.role ? user.role.replace("_", " ") : "STANDARD USER"}
                </div>
              )}

              <div className="flex items-center gap-5 px-3 text-xs font-bold tracking-wide text-gray-500 uppercase">
                <div className="flex items-center gap-1.5">🔥 Streak: <span className="text-gray-300 font-black">0 Days</span></div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">🏆 Rank: <span className="text-gray-300 font-black">Unranked</span></div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">
                Live Trivia Dispatch
              </h2>
            </div>
            
            <div className="lg:col-span-8 space-y-6">
              <p className="text-xl md:text-3xl text-gray-300 font-semibold leading-relaxed tracking-tight max-w-4xl">
                {trivia ? `"${trivia}"` : `"The circuit is live. Ready for the next run."`}
              </p>
              <p className="text-sm font-medium text-gray-500 max-w-xl leading-relaxed">
                Your profile clearance is verified. Navigate through the standard discovery grid below to launch custom sets or review open regional quiz fixtures.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}