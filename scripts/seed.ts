/**
 * Build-time seeding. Ensures data/store.json exists so the deployed demo
 * boots with content. Expanded in a later commit to run the full scan
 * pipeline over the seeded demo publications.
 */
import { loadStore, saveStore } from "@/lib/ingest/store";

const store = loadStore();
const written = saveStore(store);
console.log(`seed: store ready at ${written} (${store.publications.length} publications)`);
