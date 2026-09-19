import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Prompt files are read from disk at runtime (src/server/llm/prompts.ts).
  outputFileTracingIncludes: { "/**": ["./src/prompts/**/*.md"] },
};

export default withNextIntl(nextConfig);
