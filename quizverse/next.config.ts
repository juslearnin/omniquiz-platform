import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 1. Fix the workspace root warning by pointing directly to your quizverse folder
  turbopack: {
    root: path.resolve(__dirname),
    
    // 2. Fix the canvas error inside Turbopack
    resolveAlias: {
      canvas: "false",
    },
  },

  // Keep your legacy webpack config here for production builds (if they fallback to webpack)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;