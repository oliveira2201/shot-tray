import fs from "fs";

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

// n8n stores data as a flat array where strings that are all-digits
// are references to indices in the same array.
function resolve(val, seen = new Set()) {
  if (typeof val === "string" && /^\d+$/.test(val)) {
    const idx = parseInt(val, 10);
    if (idx < raw.length && !seen.has(idx)) {
      seen.add(idx);
      return resolve(raw[idx], seen);
    }
  }
  if (Array.isArray(val)) return val.map((v) => resolve(v, new Set(seen)));
  if (val && typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = resolve(v, new Set(seen));
    return out;
  }
  return val;
}

const root = resolve(raw[0]);
const runData = root.resultData?.runData || {};

for (const [nodeName, runs] of Object.entries(runData)) {
  console.log(`\n=== NODE: ${nodeName} ===`);
  for (const run of runs) {
    const main = run?.data?.main?.[0];
    if (main) {
      console.log(JSON.stringify(main, null, 2).slice(0, 4000));
    }
  }
}
