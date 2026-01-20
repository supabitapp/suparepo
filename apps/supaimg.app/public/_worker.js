const UPDATE_URL =
  "https://github.com/supabitapp/supaimg/releases/latest/download/update.json";
const MODELS_BASE =
  "https://github.com/supabitapp/supaimg/releases/download/models/v1/";
const DOWNLOADS_BASE =
  "https://github.com/supabitapp/supaimg/releases/download/";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/appcast/update.json") {
      return proxyRequest(request, UPDATE_URL, {
        cacheTtl: 60,
        cacheControl: "public, max-age=60",
      });
    }

    if (url.pathname === "/update.json") {
      return proxyRequest(request, UPDATE_URL, {
        cacheTtl: 60,
        cacheControl: "public, max-age=60",
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
