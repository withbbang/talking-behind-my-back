import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Vitest — Next.js 16 + React 19 + TypeScript. jsdom 환경에서 RTL 로 컴포넌트 테스트.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "app/layout.tsx", "app/manifest.ts"],
    },
  },
  resolve: {
    alias: {
      // tsconfig.json "@/*": ["./app/*"] 과 반드시 동일하게 (Homepage 에서 어긋나 고생한 지점)
      "@": resolve(__dirname, "./app"),
    },
  },
});
