"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar/navbar";

interface QuizItem {
  id: string;
  title: string;
  genre: string;
  price: number;
  questionCount: number;
  uniqueViews: number;
  downloadCount: number;
  ratingAverage: number;
}

interface ReviewItem {
  id: string;
  score: number;
  reviewText: string;
  quizTitle: string;
  reviewerName: string;
}

export default function AnalyticsDashboard() {
  const [publishedSets, setPublishedSets] = useState<QuizItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
  const [bundleTitle, setBundleTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Stats Aggregate Calculations
  const totalViews = publishedSets.reduce((acc, curr) => acc + curr.uniqueViews, 0);
  const totalDownloads = publishedSets.reduce((acc, curr) => acc + curr.downloadCount, 0);
  
  // 🪙 Sustainable Math Aggregations
  const computedGrossRevenue = publishedSets.reduce((acc, curr) => acc + (curr.downloadCount * curr.price), 0);
  const platformCut = Math.round(computedGrossRevenue * 0.30);
  const netCreatorWallet = computedGrossRevenue - platformCut;

  useEffect(() => {
    // Simulated Database Payload Hydration for your account profile
    setTimeout(() => {
      setPublishedSets([
        { id: "q1", title: "Millennium Mania Recap Final", genre: "MELA", price: 0, questionCount: 50, uniqueViews: 240, downloadCount: 110, ratingAverage: 4.8 },
        { id: "q2", title: "Internal Combustion & Cycles", genre: "SCI_TECH", price: 49, questionCount: 30, uniqueViews: 180, downloadCount: 45, ratingAverage: 4.2 },
        { id: "q3", title: "National High-Stakes BizTech '26", genre: "BIZ_TECH", price: 99, questionCount: 40, uniqueViews: 310, downloadCount: 90, ratingAverage: 4.6 }
      ]);

      setReviews([
        { id: "r1", score: 5, reviewText: "Incredible structuring on the music rounds. The metadata mappings were clean!", quizTitle: "Millennium Mania Recap Final", reviewerName: "Rohan_QuizMaster" },
        { id: "r2", score: 4, reviewText: "Solid thermodynamics question sequence. Helped our college club pack immensely.", quizTitle: "Internal Combustion & Cycles", reviewerName: "Naman_IITD" }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const toggleSelectSet = (id: string) => {
    if (selectedSetIds.includes(id)) {
      setSelectedSetIds(selectedSetIds.filter(item => item !== id));
    } else {
      setSelectedSetIds([...selectedSetIds, id]);
    }
  };

  const handleDeployComboBundle = () => {
    if (selectedSetIds.length < 2 || !bundleTitle) {
      alert("Please enter a bundle title and select at least 2 target sets to form a package.");
      return;
    }
    const rateDiscount = selectedSetIds.length >= 10 ? 25 : 15;
    alert(`Success! "${bundleTitle}" Pack initialized into network index maps compiling ${selectedSetIds.length} items at a systemic ${rateDiscount}% checkout reduction price.`);
    setSelectedSetIds([]);
    setBundleTitle("");
  };

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-black flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white pb-20">
      <Navbar />
      
      <div className="mx-auto max-w-7xl px-6 md:px-12 pt-28 space-y-12">
        {/* Header Block */}
        <div className="border-b border-white/5 pb-6">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">Portfolio Diagnostics</span>
          <h1 className="text-4xl font-black tracking-tight mt-1 text-white">Your Analytics Station</h1>
        </div>

        {/* 🪙 THE METRIC VISUALIZATION CARD HUD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-white/5 bg-[#09090d] p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Sales Accumulated</p>
            <p className="text-3xl font-black text-white mt-2">₹{computedGrossRevenue}</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Net Wallet (70% Share)</p>
            <p className="text-3xl font-black text-purple-300 mt-2">₹{netCreatorWallet}</p>
            <span className="text-[10px] text-gray-500 block mt-1">Platform Cut (30%): ₹{platformCut}</span>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#09090d] p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unique Circuit Views</p>
            <p className="text-3xl font-black text-white mt-2">{totalViews}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#09090d] p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Global Downloads</p>
            <p className="text-3xl font-black text-white mt-2">{totalDownloads}</p>
          </div>
        </div>

        {/* MAIN BODY CONFIG: BUNDLES & REVIEWS MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT AREA: COMBO BUNDLE BUILDER CONSOLE */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#07070a] p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl font-black tracking-tight text-white">Create a Combo Pack Bucket</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select items below to bundle them under a single transaction pass.</p>
              </div>

              <input 
                placeholder="Pack Bundle Name (e.g., Complete Srijan '26 Finals Pass)" 
                value={bundleTitle} 
                onChange={(e) => setBundleTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none focus:border-purple-500/40" 
              />

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block px-1">Eligible Portfolio Items</label>
                {publishedSets.map((set) => (
                  <div 
                    key={set.id}
                    onClick={() => toggleSelectSet(set.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border transition cursor-pointer ${selectedSetIds.includes(set.id) ? 'border-purple-500 bg-purple-500/5' : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.02]'}`}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{set.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{set.genre} • {set.questionCount} Questions • Single Price: ₹{set.price}</p>
                    </div>
                    <input type="checkbox" checked={selectedSetIds.includes(set.id)} onChange={() => {}} className="h-4 w-4 accent-purple-500" />
                  </div>
                ))}
              </div>

              {selectedSetIds.length > 0 && (
                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/10 p-4 text-xs font-semibold text-cyan-400">
                  🎁 System discount engine running: {selectedSetIds.length} items checked. {selectedSetIds.length >= 10 ? "25% Mega Discount" : "15% Regular Discount"} will be applied to aggregate pricing.
                </div>
              )}

              <button
                onClick={handleDeployComboBundle}
                className="w-full rounded-xl bg-purple-600 p-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-purple-500"
              >
                Compile Pack & Deploy to Marketplace
              </button>
            </div>
          </div>

          {/* RIGHT AREA: BUYER CRITIQUE DISPATCH STREAM */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-white/5 bg-[#07070a] p-6 space-y-6">
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">Verified Buyer Critique Feed</h3>
                <p className="text-xs text-gray-500 mt-0.5">Reviews left exclusively by authenticated bundle purchasers.</p>
              </div>

              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-400">@{rev.reviewerName}</span>
                      <div className="text-xs text-amber-400">{"★".repeat(rev.score)}</div>
                    </div>
                    <p className="text-xs font-bold text-gray-400 italic">Ref: {rev.quizTitle}</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{rev.reviewText}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}