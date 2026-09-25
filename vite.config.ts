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
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    clearMocks: true,
    pool: "threads",
  },
}))
