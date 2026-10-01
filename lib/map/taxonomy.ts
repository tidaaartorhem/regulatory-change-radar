import { readFileSync } from "fs";
import { join } from "path";
import type { Control } from "@/lib/types";

let cache: Control[] | null = null;

/** Load the fixed control taxonomy. The taxonomy is closed: the LLM gate may
 *  only ever emit IDs from this list, and unknown IDs are rejected. */
export function getControls(): Control[] {
  if (cache) return cache;
  const path = join(process.cwd(), "data", "controls.seed.json");
  cache = JSON.parse(readFileSync(path, "utf8")) as Control[];
  return cache;
}

/** Test hook: bypass the filesystem cache. */
export function setControlsForTest(controls: Control[]): void {
  cache = controls;
}
