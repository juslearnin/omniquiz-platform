"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/navbar/navbar";
import Hero from "@/components/hero/hero";
import QuizGrid from "@/components/quiz/QuizGrid";
import DashboardHero from "@/components/DashboardHero";
import CreatorStudio from "@/components/CreatorStudio";

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  profile?: {
    institutionName?: string | null;
    contributions?: number;
  } | null;
}

interface AnalyticsData {
  grossRevenue: number;
  netWallet: number;
  totalViews: number;
  totalDownloads: number;
}

export default function Home() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncSignal, setSyncSignal] = useState<number>(0);
  
  const [liveAnalytics, setLiveAnalytics] = useState<AnalyticsData>({
    grossRevenue: 0,
    netWallet: 0,
    totalViews: 0,
    totalDownloads: 0
  });

  // Atomic sync wrapper triggered across component boundaries to invalidate caches
  const triggerGlobalSync = useCallback(() => {
    setSyncSignal((prev) => prev + 1);
  }, []);

  useEffect(() => {
    async function checkActiveSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          setUser(null);
          localStorage.removeItem("omniquiz_user");
          return;
        }

        const data = await res.json();
        if (data && data.success && data.user) {
          setUser(data.user);
          localStorage.setItem("omniquiz_user", JSON.stringify(data.user));
        } else {
          const cachedUser = localStorage.getItem("omniquiz_user");
          if (cachedUser) setUser(JSON.parse(cachedUser));
        }
      } catch {
        const cachedUser = localStorage.getItem("omniquiz_user");
        if (cachedUser) setUser(JSON.parse(cachedUser));
      } finally {
        setLoading(false);
      }
    }
    checkActiveSession();
  }, [syncSignal]);

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-[#020205] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-purple-500/20 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Analytics visibility condition parameter: Must have at least 1 verified view or physical contribution upload row
  const hasContentFootprint = liveAnalytics.totalViews > 0 || liveAnalytics.totalDownloads > 0 || (user?.profile?.contributions || 0) > 0;

  return (
    <main className="min-h-screen bg-[#020205] text-white selection:bg-purple-500/30 selection:text-purple-200" suppressHydrationWarning={true}>
      <Navbar />

      {!user ? (
        <div className="space-y-10">
          <Hero />
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-16">
            <QuizGrid
              syncSignal={syncSignal}
              currentUserId={null}
              currentUserEmail={null}
              onDataSync={setLiveAnalytics}
              onActionExecuted={triggerGlobalSync}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Banner Identity Greeting & Institutional Slat Badges */}
          <DashboardHero />
          
          {/* 🔥 POSITION 1: WIDE DISCOVERY SHELF GRID (DEDICATED PURELY TO CONSUMPTION) */}
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-16">
            <QuizGrid 
              syncSignal={syncSignal} 
              currentUserId={user.id}
              currentUserEmail={user.email}
              onDataSync={setLiveAnalytics} 
              onActionExecuted={triggerGlobalSync} 
            />
          </div>

          {/* 🔮 POSITION 2: CREATOR RUNWAY TERMINAL (WITH CONSOLE HUD GATED AND ANCHORED INSIDE) */}
          <div id="creator-studio-runway" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-24 border-t border-white/5 pt-14 scroll-mt-28">
            <CreatorStudio 
              analytics={liveAnalytics} 
              userContributions={user.profile?.contributions || 0}
              showLedger={hasContentFootprint}
              onUploadSuccess={triggerGlobalSync}
            />
          </div>
        </div>
      )}
    </main>
  );
}
