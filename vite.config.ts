/// <reference types="vitest/config" />
import { existsSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"

import devServer from "@hono/vite-dev-server"
import solid from "@solidjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { cn as cnTables } from "cn/vite"
import { routePathFromFile } from "filesystem-routing"
import { fileRoutes } from "filesystem-routing/vite"
import { defineConfig } from "vite"

// The dev API reads process.env like the deployed function does.
if (existsSync(".env")) {
  process.loadEnvFile()
}

export default defineConfig(({ mode }) => ({
  build: {
    target: "es2023",
  },
  plugins: [
    // Tests sit beside their routes without becoming pages.
    fileRoutes({
      toPath: (file) =>
        file.endsWith(".test") ? undefined : routePathFromFile(file),
    }),
    solid(),
    tailwindcss(),
    // Compiles merge tables for only the classes we use, into src/lib.
    cnTables({ content: ["src/**/*.{ts,tsx}"], out: "src/lib/cn-tables.ts" }),
    // Serves the Hono app for /api in dev; everything else falls through to
    // Vite, as Vercel's rewrites do in production.
    mode !== "test" &&
      devServer({
        entry: "server/index.ts",
        exclude: [/^(?!\/api(?:\/|$))/],
        injectClientScript: false,
      }),
  ],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    environment: "happy-dom",
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          globals: true,
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: "./src/test/setup.ts",
          pool: "threads",
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
    ],
  },
}))
