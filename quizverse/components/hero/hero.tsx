"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Hero() {
  const [isMounted, setIsMounted] = useState(false);

  // This only runs once the component hits the browser
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10" />

      {/* We use a standard div on the server, and switch to motion.div 
        only after mounting on the client to completely bypass the hydration error.
      */}
      {!isMounted ? (
        <div className="relative mx-auto max-w-5xl text-center opacity-0 translate-y-10">
          <h1 className="text-5xl md:text-7xl font-black leading-tight">
            The Future of{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Quizzing
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
            Discover premium quiz sets, hire elite quizmasters,
            host quiz parties, and build your quizzing identity.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-5xl text-center"
        >
          <h1 className="text-5xl md:text-7xl font-black leading-tight">
            The Future of{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Quizzing
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
            Discover premium quiz sets, hire elite quizmasters,
            host quiz parties, and build your quizzing identity.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <button className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-black hover:bg-cyan-300 transition">
              Explore Sets
            </button>

            <button className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 hover:bg-white/10 transition">
              Become a QM
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
