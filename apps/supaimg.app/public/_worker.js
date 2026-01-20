const RELEASES_API = "https://api.github.com/repos/supabitapp/supaimg/releases?per_page=20";
const UPDATE_ASSET_NAME = "update.json";
const MODELS_BASE = "https://github.com/supabitapp/supaimg/releases/download/models/v1/";
const DOWNLOADS_BASE = "https://github.com/supabitapp/supaimg/releases/download/";
const LATEST_CACHE_TTL_MS = 5 * 60 * 1000;
let latestReleaseCache = { value: null, expiresAt: 0 };
let latestReleasePromise = null;

const methodNotAllowed = () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  });

const buildTargetUrl = (target, requestUrl) => {
  const targetUrl = new URL(target);
  targetUrl.search = requestUrl.search;
  return targetUrl.toString();
};

const proxyRequest = async (request, target, options = {}) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
  };

  if (options.cacheTtl || options.cacheEverything) {
    init.cf = {
      cacheTtl: options.cacheTtl,
      cacheEverything: Boolean(options.cacheEverything),
    };
  }

  const requestUrl = new URL(request.url);
  const response = await fetch(buildTargetUrl(target, requestUrl), init);
  const outHeaders = new Headers(response.headers);
  if (options.cacheControl) {
    outHeaders.set("cache-control", options.cacheControl);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
};

const normalizeDownloadPath = (path) => {
  if (!path) {
    return path;
  }
  const segments = path.split("/");
  if (segments.length >= 3 && segments[0] === "supaimg" && segments[1].startsWith("v")) {
    const encodedTag = encodeURIComponent(`${segments[0]}/${segments[1]}`);
    return [encodedTag, ...segments.slice(2)].join("/");
  }
  return path;
};

const isAppRelease = (release) => {
  if (!release || typeof release !== "object") {
    return false;
  }
  if (release.draft || release.prerelease) {
    return false;
  }
  if (typeof release.tag_name !== "string" || !release.tag_name.startsWith("supaimg/")) {
    return false;
  }
  if (!Array.isArray(release.assets)) {
    return false;
  }
  return release.assets.some((asset) => asset?.name === UPDATE_ASSET_NAME);
};

const getLatestRelease = async (request) => {
  const now = Date.now();
  if (latestReleaseCache.value && now < latestReleaseCache.expiresAt) {
    return latestReleaseCache.value;
  }

  if (latestReleasePromise) {
    return latestReleasePromise;
  }

  latestReleasePromise = (async () => {
    const headers = new Headers(request.headers);
    headers.set("accept", "application/vnd.github+json");
    headers.set("user-agent", "supaimg-appcast-worker");
    const response = await fetch(RELEASES_API, { method: "GET", headers });
    if (!response.ok) {
      latestReleaseCache = { value: null, expiresAt: now + 60 * 1000 };
      return null;
    }

    const releases = await response.json();
    if (!Array.isArray(releases)) {
      latestReleaseCache = { value: null, expiresAt: now + 60 * 1000 };
      return null;
    }

    const release = releases.find(isAppRelease);
    if (!release) {
      latestReleaseCache = { value: null, expiresAt: now + 60 * 1000 };
      return null;
    }

    const tag = release.tag_name;
    const encodedTag = encodeURIComponent(tag);
    const updateUrl = `https://github.com/supabitapp/supaimg/releases/download/${encodedTag}/${UPDATE_ASSET_NAME}`;
    const value = { tag, encodedTag, updateUrl };
    latestReleaseCache = { value, expiresAt: now + LATEST_CACHE_TTL_MS };
    return value;
  })();

  try {
    return await latestReleasePromise;
  } finally {
    latestReleasePromise = null;
  }
};

const redirectToLatestAsset = async (request, filename) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const release = await getLatestRelease(request);
  if (!release) {
    return new Response("Latest release not available", { status: 502 });
  }

  const url = new URL(request.url);
  const targetUrl = new URL(`/appcast/${release.encodedTag}/${filename}`, url);
  targetUrl.search = url.search;

  return new Response(null, {
    status: 302,
    headers: {
      location: targetUrl.toString(),
      "cache-control": "public, max-age=300",
    },
  });
};

const rewriteUpdateJson = async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const isHead = request.method === "HEAD";
  const release = await getLatestRelease(request);
  if (!release) {
    return new Response("Latest release not available", { status: 502 });
  }

  const response = await fetch(release.updateUrl, { method: "GET", headers: request.headers });
  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const data = await response.json();
  const version = data?.version;
  if (typeof version === "string" && data?.platforms) {
    const tag = release.tag || `supaimg/v${version}`;
    const encodedTag = encodeURIComponent(tag);
    const origin = new URL(request.url).origin;
    for (const platform of Object.values(data.platforms)) {
      if (platform && typeof platform === "object" && platform.url) {
        const parts = String(platform.url).split("/");
        const filename = parts[parts.length - 1] || "";
        if (filename) {
          platform.url = `${origin}/appcast/${encodedTag}/${filename}`;
        }
      }
    }
  }

  const headers = {
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };
  if (isHead) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers,
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/appcast/update.json") {
      return rewriteUpdateJson(request);
    }

    if (url.pathname === "/update.json") {
      return rewriteUpdateJson(request);
    }

    if (url.pathname.startsWith("/appcast/supaimg/latest/")) {
      const path = url.pathname.slice("/appcast/supaimg/latest/".length);
      if (!path) {
        return new Response("Not Found", { status: 404 });
      }
      return redirectToLatestAsset(request, path);
    }

    if (url.pathname.startsWith("/appassets/")) {
      const path = url.pathname.slice("/appassets/".length);
      if (!path) {
        return new Response("Not Found", { status: 404 });
      }
      return proxyRequest(request, `${MODELS_BASE}${path}`, {
        cacheTtl: 31536000,
        cacheEverything: true,
        cacheControl: "public, max-age=31536000, immutable",
      });
    }

    if (url.pathname.startsWith("/models/")) {
      const path = url.pathname.slice("/models/".length);
      if (!path) {
        return new Response("Not Found", { status: 404 });
      }
      return proxyRequest(request, `${MODELS_BASE}${path}`, {
        cacheTtl: 31536000,
        cacheEverything: true,
        cacheControl: "public, max-age=31536000, immutable",
      });
    }

    if (url.pathname.startsWith("/appcast/")) {
      const rawPath = url.pathname.slice("/appcast/".length);
      const path = normalizeDownloadPath(rawPath);
      if (!path) {
        return new Response("Not Found", { status: 404 });
      }
      return proxyRequest(request, `${DOWNLOADS_BASE}${path}`, {
        cacheTtl: 31536000,
        cacheEverything: true,
        cacheControl: "public, max-age=31536000, immutable",
      });
    }

    if (url.pathname.startsWith("/downloads/")) {
      const rawPath = url.pathname.slice("/downloads/".length);
      const path = normalizeDownloadPath(rawPath);
      if (!path) {
        return new Response("Not Found", { status: 404 });
      }
      return proxyRequest(request, `${DOWNLOADS_BASE}${path}`, {
        cacheTtl: 31536000,
        cacheEverything: true,
        cacheControl: "public, max-age=31536000, immutable",
      });
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("ASSETS binding not available", { status: 500 });
    }
    return env.ASSETS.fetch(request);
  },
};
