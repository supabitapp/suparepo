const DOWNLOADS_BASE = "https://github.com/supabitapp/supacode/releases/download/";
const LATEST_BASE = "https://github.com/supabitapp/supacode/releases/latest/download/";
const CHECKSUMS_FILE = "checksums.json";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const VOLATILE_CACHE_CONTROL = "public, max-age=300";
const NO_STORE_CACHE_CONTROL = "no-store";

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

const hexDigest = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const normalizeSHA256 = (value) =>
  typeof value === "string" ? value.toLowerCase().replace(/^sha256:/, "") : null;

const responseWithHeaders = (response, headers) => {
  const outHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    outHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
};

const uncachedResponse = (response, cacheStatus) =>
  responseWithHeaders(response, {
    "cache-control": NO_STORE_CACHE_CONTROL,
    "x-supacode-cache": cacheStatus,
  });

const upstreamFailureResponse = () =>
  new Response("Upstream fetch failed", {
    status: 502,
    headers: {
      "cache-control": NO_STORE_CACHE_CONTROL,
      "x-supacode-cache": "bypass",
    },
  });

const resolveDownload = (path) => {
  if (!path) {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const tag = segments[0];
  const assetName = segments.slice(1).join("/");
  if (tag === "latest") {
    return {
      assetName,
      cacheControl: VOLATILE_CACHE_CONTROL,
      manifestTarget: `${LATEST_BASE}${CHECKSUMS_FILE}`,
      target: `${LATEST_BASE}${assetName}`,
    };
  }

  const cacheControl = tag === "tip" ? VOLATILE_CACHE_CONTROL : IMMUTABLE_CACHE_CONTROL;
  return {
    assetName,
    cacheControl,
    manifestTarget: `${DOWNLOADS_BASE}${tag}/${CHECKSUMS_FILE}`,
    target: `${DOWNLOADS_BASE}${segments.join("/")}`,
  };
};

const proxyHeadRequest = async (request, target) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
  };

  const requestUrl = new URL(request.url);
  let response;
  try {
    response = await fetch(buildTargetUrl(target, requestUrl), init);
  } catch {
    return upstreamFailureResponse();
  }
  return uncachedResponse(response, "bypass");
};

const checksumEntry = async (route) => {
  let response;
  try {
    response = await fetch(route.manifestTarget, { method: "GET" });
  } catch {
    return null;
  }
  if (!response.ok) {
    return null;
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch {
    return null;
  }
  const entry = manifest?.assets?.[route.assetName];
  const sha256 = normalizeSHA256(entry?.sha256 ?? entry?.digest);
  const size = Number(entry?.size);
  if (!sha256 || !Number.isSafeInteger(size) || size < 0) {
    return null;
  }

  return { sha256, size };
};

const verifiedDownloadResponse = async (request, route) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  if (request.method === "HEAD" || request.headers.has("range") || !globalThis.caches?.default) {
    return proxyHeadRequest(request, route.target);
  }

  const requestUrl = new URL(request.url);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return responseWithHeaders(cached, { "x-supacode-cache": "hit" });
  }

  const entry = await checksumEntry(route);
  const headers = new Headers(request.headers);
  headers.delete("host");
  const targetUrl = buildTargetUrl(route.target, requestUrl);
  let response;
  try {
    response = await fetch(targetUrl, { method: "GET", headers });
  } catch {
    return upstreamFailureResponse();
  }
  if (!response.ok) {
    return uncachedResponse(response, "bypass");
  }

  if (!entry) {
    return uncachedResponse(response, "bypass");
  }

  const buffer = await response.arrayBuffer();
  const actualSize = buffer.byteLength;
  const actualSHA256 = hexDigest(await crypto.subtle.digest("SHA-256", buffer));
  if (actualSize !== entry.size || actualSHA256 !== entry.sha256) {
    return new Response("Checksum mismatch", {
      status: 502,
      headers: {
        "cache-control": NO_STORE_CACHE_CONTROL,
        "x-supacode-cache": "checksum-mismatch",
      },
    });
  }

  const outHeaders = new Headers(response.headers);
  outHeaders.set("cache-control", route.cacheControl);
  const cacheResponse = new Response(buffer, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
  await caches.default.put(cacheKey, cacheResponse.clone());
  return responseWithHeaders(cacheResponse, { "x-supacode-cache": "validated" });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/download/")) {
      const rawPath = url.pathname.slice("/download/".length);
      const route = resolveDownload(rawPath);
      if (!route) {
        return new Response("Not Found", { status: 404 });
      }
      return verifiedDownloadResponse(request, route);
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("ASSETS binding not available", { status: 500 });
    }
    return env.ASSETS.fetch(request);
  },
};
