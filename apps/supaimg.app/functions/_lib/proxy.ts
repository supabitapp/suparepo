const methodNotAllowed = () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  });

const buildTargetUrl = (target: string, request: Request) => {
  const requestUrl = new URL(request.url);
  const targetUrl = new URL(target);
  targetUrl.search = requestUrl.search;
  return targetUrl.toString();
};

export const proxyRequest = async (
  request: Request,
  target: string,
  options: {
    cacheTtl?: number;
    cacheEverything?: boolean;
    cacheControl?: string;
  } = {},
) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  const cf: Record<string, unknown> = {};
  if (typeof options.cacheTtl === "number") {
    cf.cacheTtl = options.cacheTtl;
  }
  if (options.cacheEverything) {
    cf.cacheEverything = true;
  }

  const init: RequestInit & { cf?: Record<string, unknown> } = {
    method: request.method,
    headers,
  };
  if (Object.keys(cf).length > 0) {
    init.cf = cf;
  }

  const response = await fetch(buildTargetUrl(target, request), init);
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

export const normalizePath = (value?: string | string[]) => {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join("/");
  }
  return value;
};
