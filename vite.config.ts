/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig(({ mode }) => ({
  build: {
    target: "es2023",
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "\\.test\\.(ts|tsx)$",
    }),
    react({ compiler: mode !== "test" }),
    tailwindcss(),
    mode !== "test" && cloudflare(),
  ],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
    pool: "threads",
  },
}))
