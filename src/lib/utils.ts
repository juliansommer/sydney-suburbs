import { createCn } from "cn/engine"

import tables from "./cn-tables"

// Merges Tailwind classes using tables compiled from our sources at build
// time, so the bundle only carries the classes we actually use.
export const cn = createCn(tables)
