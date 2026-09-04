"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/ad-performance.ts
function rankLibraryAds(ads) {
  const now = Date.now();
  const withSignals = ads.map((ad, index) => {
    const runtimeDays = ad.runtime_days ?? (ad.started_date ? Math.max(0, Math.floor((now - Date.parse(ad.started_date)) / 864e5)) : null);
    const activeSeconds = ad.total_active_time ?? null;
    const activeDays = activeSeconds && activeSeconds > 0 ? Math.max(1, Math.round(activeSeconds / 86400)) : null;
    const libraryRank = index + 1;
    let score = 100 - Math.min(60, libraryRank * 4);
    if (runtimeDays != null) {
      if (runtimeDays >= 45) score += 25;
      else if (runtimeDays >= 21) score += 18;
      else if (runtimeDays >= 7) score += 10;
      else score += 2;
    }
    if (activeDays != null) {
      if (activeDays >= 30) score += 15;
      else if (activeDays >= 14) score += 10;
      else if (activeDays >= 7) score += 5;
    }
    if (ad.has_multiple_versions) score += 5;
    if ((ad.publisher_platforms || []).length >= 2) score += 3;
    return {
      ...ad,
      library_rank: libraryRank,
      runtime_days: runtimeDays,
      total_active_time: activeSeconds,
      performance_score: Math.min(99, Math.max(10, Math.round(score)))
    };
  });
  const sortedByScore = [...withSignals].sort(
    (a, b) => (b.performance_score || 0) - (a.performance_score || 0)
  );
  const winnerCutoff = Math.max(1, Math.ceil(sortedByScore.length * 0.25));
  const winnerIds = new Set(
    sortedByScore.slice(0, winnerCutoff).map((a) => a.library_id)
  );
  const scalingIds = new Set(
    sortedByScore.slice(winnerCutoff, winnerCutoff + Math.max(1, Math.ceil(sortedByScore.length * 0.35))).map(
      (a) => a.library_id
    )
  );
  return withSignals.map((ad) => {
    const rating = winnerIds.has(ad.library_id) ? "WINNER" : scalingIds.has(ad.library_id) ? "SCALING" : "TESTING";
    const reasons = [];
    if (ad.library_rank && ad.library_rank <= 3) {
      reasons.push(`#${ad.library_rank} in Library (sorted by total impressions)`);
    } else if (ad.library_rank) {
      reasons.push(`Library rank #${ad.library_rank} by impressions`);
    }
    if (ad.runtime_days != null && ad.runtime_days >= 14) {
      reasons.push(`Running ${ad.runtime_days}d \u2014 sustained delivery`);
    } else if (ad.runtime_days != null && ad.runtime_days < 7) {
      reasons.push(`Newer creative (${ad.runtime_days}d) \u2014 still testing`);
    }
    if ((ad.publisher_platforms || []).includes("Instagram")) {
      reasons.push("Active on Instagram");
    }
    const label = rating === "WINNER" ? "Best performer signal" : rating === "SCALING" ? "Strong runner" : "Newer / testing";
    return {
      ...ad,
      performance_rating: rating,
      performance_label: label,
      performance_reason: reasons.join(" \xB7 ") || "Active in Meta Ad Library \u2014 compare creatives and pick what fits your store",
      winning_strategy_hook: ad.headline || ad.primary_text?.slice(0, 80) || "Replicate hook + format with your product"
    };
  });
}
var init_ad_performance = __esm({
  "src/lib/ad-performance.ts"() {
    "use strict";
  }
});

// src/lib/playwright-browser.ts
function resolveChromiumExecutable(root) {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE.trim();
    if (fromEnv && (0, import_fs.existsSync)(fromEnv)) return fromEnv;
  }
  try {
    const playwright = require("playwright");
    const bundled = playwright.chromium.executablePath();
    if (bundled && (0, import_fs.existsSync)(bundled)) return bundled;
  } catch {
  }
  if (process.platform === "darwin") {
    for (const candidate of MAC_SYSTEM_CHROME) {
      if ((0, import_fs.existsSync)(candidate)) return candidate;
    }
  }
  if (root) {
    const cached = import_path.default.join(root, "scripts", "chromium-path.txt");
    if ((0, import_fs.existsSync)(cached)) {
      const fromFile = (0, import_fs.readFileSync)(cached, "utf8").trim();
      if (fromFile && (0, import_fs.existsSync)(fromFile)) return fromFile;
    }
  }
  return void 0;
}
function chromiumLaunchOptions(executablePath) {
  return {
    headless: true,
    executablePath,
    args: [
      "--headless=new",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage"
    ]
  };
}
function isBrowserLaunchError(message) {
  return /Executable doesn't exist|browserType\.launch|Target page, context or browser has been closed|Browser logs|ENOENT|spawn|SIGABRT|crash/i.test(
    message
  );
}
var import_fs, import_path, MAC_SYSTEM_CHROME;
var init_playwright_browser = __esm({
  "src/lib/playwright-browser.ts"() {
    "use strict";
    import_fs = require("fs");
    import_path = __toESM(require("path"));
    MAC_SYSTEM_CHROME = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
  }
});

// src/lib/meta-ad-library.ts
function buildAdLibraryUrl(input) {
  const country = input.country || "IN";
  const params = new URLSearchParams();
  params.set("active_status", "active");
  params.set("ad_type", "all");
  params.set("country", country);
  params.set("is_targeted_country", "false");
  params.set("media_type", "all");
  if (input.pageId) {
    params.set("page_ids[0]", input.pageId);
  }
  if (input.publisherPlatform && input.publisherPlatform !== "all") {
    params.set("publisher_platforms[0]", input.publisherPlatform);
  }
  if (input.searchTerms) {
    params.set("q", `"${input.searchTerms.replace(/"/g, "")}"`);
    params.set("search_type", "keyword_exact_phrase");
  } else if (input.pageId) {
    params.set("view_all_page_id", input.pageId);
    params.set("search_type", "page");
  }
  if (input.sortByImpressions !== false) {
    params.set("sort_data[mode]", "total_impressions");
    params.set("sort_data[direction]", "desc");
  }
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}
var init_meta_ad_library = __esm({
  "src/lib/meta-ad-library.ts"() {
    "use strict";
    init_playwright_browser();
  }
});

// src/lib/meta-ad-library-parse.ts
function extractAdsFromGraphqlPayload(json) {
  const ads = [];
  const seen = /* @__PURE__ */ new Set();
  const textFromBody = (body) => {
    if (!body) return "";
    if (typeof body === "string") return body;
    if (typeof body === "object" && body !== null && "text" in body) {
      return String(body.text || "");
    }
    return "";
  };
  const mediaFromSnapshot = (snap) => {
    const cards = snap.cards || [];
    const images = snap.images || [];
    const videos = snap.videos || [];
    const card0 = cards[0] || {};
    const body = textFromBody(card0.body) || textFromBody(snap.body) || String(card0.link_description || snap.link_description || "");
    const headline = String(card0.title || snap.title || snap.link_title || "").replace(/\{\{[^}]+\}\}/g, "").trim();
    const cta = String(
      card0.cta_text || snap.cta_text || card0.cta_type || snap.cta_type || "Shop Now"
    ).replace(/_/g, " ");
    const media = card0.original_image_url || card0.resized_image_url || card0.video_preview_image_url || images[0]?.original_image_url || images[0]?.resized_image_url || videos[0]?.video_preview_image_url || null;
    const isVideo = Boolean(
      card0.video_hd_url || card0.video_sd_url || Array.isArray(videos) && videos.length > 0
    );
    const isCarousel = cards.length > 1;
    return { media, isVideo, isCarousel, body, headline, cta };
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const n = node;
    const archiveId = n.ad_archive_id || n.adArchiveId;
    if (archiveId && n.snapshot) {
      const id = String(archiveId);
      if (!seen.has(id)) {
        seen.add(id);
        const snap = n.snapshot || {};
        const extracted = mediaFromSnapshot(snap);
        const platforms = n.publisher_platform || n.publisher_platforms || [];
        const startTs = n.start_date || n.ad_delivery_start_time;
        let started = null;
        if (typeof startTs === "number") {
          started = new Date(startTs * 1e3).toISOString().slice(0, 10);
        } else if (typeof startTs === "string") {
          started = startTs.slice(0, 10);
        }
        const activeTime = typeof n.total_active_time === "number" ? n.total_active_time : null;
        const collationCount = typeof n.collation_count === "number" ? n.collation_count : null;
        ads.push({
          id: `lib_${id}`,
          library_id: id,
          ad_format: extracted.isVideo ? "video" : extracted.isCarousel ? "carousel" : "single_image",
          primary_text: extracted.body || "",
          headline: extracted.headline,
          cta: extracted.cta,
          active_status: n.is_active === false ? "UNKNOWN" : "ACTIVE",
          started_date: started,
          publisher_platforms: platforms.map(
            (p) => String(p).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
          ),
          media_url: extracted.media,
          snapshot_url: `https://www.facebook.com/ads/library/?id=${id}`,
          source: "web_library",
          total_active_time: activeTime,
          has_multiple_versions: collationCount != null ? collationCount > 1 : void 0
        });
      }
    }
    if (n.collated_results) visit(n.collated_results);
    for (const v of Object.values(n)) {
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(json);
  return ads;
}
var init_meta_ad_library_parse = __esm({
  "src/lib/meta-ad-library-parse.ts"() {
    "use strict";
  }
});

// src/lib/meta-ad-library-web-fetch.ts
async function runAdLibraryWebFetchInProcess(input) {
  const libraryUrl = buildAdLibraryUrl(input);
  const limit = input.limit || 20;
  if (!input.pageId && !input.searchTerms) {
    return {
      ads: [],
      method: "none",
      libraryUrl,
      error: "Need meta_page_id or search terms"
    };
  }
  try {
    const playwright = await import("playwright");
    const executablePath = resolveChromiumExecutable(process.cwd());
    if (!executablePath) {
      throw new Error(
        "Chromium executable not found. On macOS install Google Chrome, or run: npx playwright install chromium"
      );
    }
    const browser = await playwright.chromium.launch(chromiumLaunchOptions(executablePath));
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    const collected = [];
    const seen = /* @__PURE__ */ new Set();
    const pending = [];
    page.on("response", (response) => {
      const task = (async () => {
        try {
          const url = response.url();
          if (!url.includes("graphql")) return;
          const status = response.status();
          if (status < 200 || status >= 300) return;
          const text = await response.text();
          if (!/ad_archive_id|adArchiveId|collated_results/i.test(text)) return;
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            return;
          }
          for (const ad of extractAdsFromGraphqlPayload(json)) {
            if (seen.has(ad.library_id)) continue;
            seen.add(ad.library_id);
            collected.push(ad);
          }
        } catch {
        }
      })();
      pending.push(task);
    });
    await page.goto(libraryUrl, { waitUntil: "domcontentloaded", timeout: 6e4 });
    await page.waitForTimeout(4e3);
    for (let i = 0; i < 8 && collected.length < limit; i++) {
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1400);
    }
    await Promise.allSettled(pending);
    await page.waitForTimeout(500);
    await browser.close();
    const ranked = rankLibraryAds(
      collected.map((ad) => ({
        ...ad,
        source: "web_library"
      }))
    ).slice(0, limit);
    return {
      ads: ranked,
      method: "web_library",
      libraryUrl,
      note: ranked.length === 0 ? "Web Library returned 0 ads (Meta may have blocked the headless session). Open the Library URL manually and confirm page_id." : `Fetched ${ranked.length} live ads from Meta Ad Library (sorted like Library total impressions). Badges use Library rank + runtime \u2014 Meta does not publish commercial spend for these ads.`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsChromium = isBrowserLaunchError(message);
    return {
      ads: [],
      method: "web_library",
      libraryUrl,
      error: message,
      note: needsChromium ? "Install Chromium: npx playwright install chromium \u2014 then click Refresh from Ad Library." : `Ad Library web fetch failed: ${message.slice(0, 120)}`
    };
  }
}
var init_meta_ad_library_web_fetch = __esm({
  "src/lib/meta-ad-library-web-fetch.ts"() {
    "use strict";
    init_ad_performance();
    init_meta_ad_library();
    init_meta_ad_library_parse();
    init_playwright_browser();
  }
});

// scripts/fetch-ad-library-web.ts
var fetch_ad_library_web_exports = {};
__export(fetch_ad_library_web_exports, {
  runAdLibraryWebFetchInProcess: () => runAdLibraryWebFetchInProcess
});
module.exports = __toCommonJS(fetch_ad_library_web_exports);
init_meta_ad_library_web_fetch();
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw || "{}");
  const result = await runAdLibraryWebFetchInProcess(input);
  process.stdout.write(JSON.stringify(result));
}
var invokedDirectly = typeof require !== "undefined" && typeof module !== "undefined" && require.main === module;
if (invokedDirectly) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runAdLibraryWebFetchInProcess
});
