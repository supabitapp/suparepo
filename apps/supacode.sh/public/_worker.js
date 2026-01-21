const DOWNLOADS_BASE = "https://github.com/supabitapp/supacode-sh/releases/download/";
const LATEST_BASE = "https://github.com/supabitapp/supacode-sh/releases/latest/download/";

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

const resolveDownloadTarget = (path) => {
  if (!path) {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) {
    return null;
  }
  if (segments[0] === "latest") {
    return `${LATEST_BASE}${segments.slice(1).join("/")}`;
  }
  return `${DOWNLOADS_BASE}${segments.join("/")}`;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/download/")) {
      const rawPath = url.pathname.slice("/download/".length);
      const target = resolveDownloadTarget(rawPath);
      if (!target) {
        return new Response("Not Found", { status: 404 });
      }
      const isLatest = rawPath.split("/")[0] === "latest";
      const cacheOptions = isLatest
        ? {
            cacheTtl: 300,
            cacheEverything: true,
            cacheControl: "public, max-age=300",
          }
        : {
            cacheTtl: 31536000,
            cacheEverything: true,
            cacheControl: "public, max-age=31536000, immutable",
          };
      return proxyRequest(request, target, cacheOptions);
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("ASSETS binding not available", { status: 500 });
    }
    return env.ASSETS.fetch(request);
  },
};
