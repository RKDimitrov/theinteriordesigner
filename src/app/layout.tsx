import type { ReactNode } from "react";

// The real root layout lives in [locale]/layout.tsx. This pass-through lets
// route handlers such as /auth/callback live outside the locale segment.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
