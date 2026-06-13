import { parseDef } from "./parse";
import { parseLefMacros } from "./lef";
import type { MacroSize, PlacementPayload } from "./types";

const lefCache = new Map<string, Map<string, MacroSize>>();

async function loadLef(url: string): Promise<Map<string, MacroSize>> {
  const cached = lefCache.get(url);
  if (cached) return cached;
  const text = await (await fetch(url)).text();
  const sizes = parseLefMacros(text);
  lefCache.set(url, sizes);
  return sizes;
}

/** Fetch a DEF (+ LEF for macro sizes) and parse into a PlacementPayload. */
export async function loadPlacement(defUrl: string, lefUrl: string): Promise<PlacementPayload> {
  const [sizes, defText] = await Promise.all([loadLef(lefUrl), fetch(defUrl).then((r) => r.text())]);
  return parseDef(defText, sizes);
}
