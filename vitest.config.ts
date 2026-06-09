import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
      "app/**/*.{test,spec}.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@domain": resolve(__dirname, "./src/domain"),
      "@services": resolve(__dirname, "./src/services"),
      "@persistence": resolve(__dirname, "./src/persistence"),
      "@ui": resolve(__dirname, "./src/ui"),
    },
  },
});
