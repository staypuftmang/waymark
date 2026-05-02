import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path alias so test imports look like
      // production imports.
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "app/**/__tests__/**/*.{ts,tsx}"],
    // Don't pick up Next's own build output if anyone moves files around.
    exclude: ["node_modules/**", ".next/**"],
  },
});
