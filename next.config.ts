import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { useTypeScriptCli: false, workerThreads: true },
  webpack(config) {
    config.module.rules.push({
      test: /globals\.css$/,
      enforce: "pre",
      use: ["@tailwindcss/turbopack"],
    });
    return config;
  },
};

export default config;
