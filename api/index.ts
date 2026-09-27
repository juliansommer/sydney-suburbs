import { handle } from "hono/vercel"

import app from "../server/index.js"

// vercel.json rewrites every /api/* path here; Hono routes on the original URL.
const handler = handle(app)

export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
