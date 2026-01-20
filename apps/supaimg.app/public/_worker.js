const UPDATE_URL = "https://github.com/supabitapp/supaimg/releases/latest/download/update.json";
const MODELS_BASE = "https://github.com/supabitapp/supaimg/releases/download/models/v1/";
const DOWNLOADS_BASE = "https://github.com/supabitapp/supaimg/releases/download/";

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

const rewriteUpdateJson = async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const isHead = request.method === "HEAD";
  const response = await fetch(UPDATE_URL, { method: "GET", headers: request.headers });
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
    const tag = `supaimg/v${version}`;
    for (const platform of Object.values(data.platforms)) {
      if (platform && typeof platform === "object" && platform.url) {
        const parts = String(platform.url).split("/");
        const filename = parts[parts.length - 1] || "";
        if (filename) {
          platform.url = `https://supaimg.app/appcast/${tag}/${filename}`;
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
      const path = url.pathname.slice("/appcast/".length);
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
      const path = url.pathname.slice("/downloads/".length);
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
