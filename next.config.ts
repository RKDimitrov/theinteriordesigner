import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Prompt files are read from disk at runtime (src/server/llm/prompts.ts).
  outputFileTracingIncludes: { "/**": ["./src/prompts/**/*.md"] },
  // 3D models and textures are large and rarely change: cache for a day, then revalidate in the background.
  async headers() {
    return ["/models/:path*", "/textures/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
    }));
  },
};

export default withNextIntl(nextConfig);
