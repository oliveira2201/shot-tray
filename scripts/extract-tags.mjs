import fs from "fs";

// Extract body values from all .json exec files in /tmp
const files = process.argv.slice(2);

for (const file of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    // Find the body object via heuristic: first object with taginternals key
    const findBody = (v, depth = 0) => {
      if (depth > 6 || !v) return null;
      if (typeof v === "object" && !Array.isArray(v)) {
        if ("taginternals" in v && typeof v.taginternals !== "object") return v;
        for (const k of Object.keys(v)) {
          const r = findBody(v[k], depth + 1);
          if (r) return r;
        }
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          const r = findBody(item, depth + 1);
          if (r) return r;
        }
      }
      return null;
    };

    // Resolver for n8n flat format
    const resolve = (val, seen = new Set()) => {
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
    };

    const root = resolve(raw[0]);
    const body = findBody(root);
    if (body) {
      const keys = Object.keys(body).filter((k) => typeof body[k] !== "object");
      console.log(`\n[${file}]`);
      console.log(`  taginternals: "${body.taginternals}"`);
      console.log(`  keys: ${keys.join(", ")}`);
      console.log(`  FNAME: ${body.FNAME ?? body.fname}  PHONE: ${body.PHONE ?? body.phone}  EMAIL: ${body.EMAIL ?? body.email}`);
      console.log(`  TRACKNUMB: ${(body.TRACKNUMB ?? body.tracknumb ?? "").toString().slice(0, 80)}`);
    } else {
      console.log(`[${file}] NO BODY FOUND`);
    }
  } catch (e) {
    console.error(`[${file}] ERROR: ${e.message}`);
  }
}
