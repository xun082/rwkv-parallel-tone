import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSensitiveFilterRules,
  SensitiveFilterMatcher,
} from "@/lib/sensitive-filter";

/**
 * Path to the source word list. It lives at the project root under `data/`,
 * outside `public/`, so it is never served as a static file. Deployment
 * bundlers are told to include it via `outputFileTracingIncludes` in
 * next.config.ts. Edit this file to update the list.
 */
const FILTER_PATH = join(process.cwd(), "data", "filter.txt");

let matcher: SensitiveFilterMatcher | null = null;

/**
 * The one sensitive-word matcher, built lazily from `data/filter.txt` and
 * cached for the process. Read once (a few ms), then reused. The list stays on
 * the server: it is not served as a static file and is not in any client bundle.
 */
export function getServerSensitiveGuard(): SensitiveFilterMatcher {
  if (!matcher) {
    const text = readFileSync(FILTER_PATH, "utf8");
    matcher = new SensitiveFilterMatcher(parseSensitiveFilterRules(text));
  }
  return matcher;
}
