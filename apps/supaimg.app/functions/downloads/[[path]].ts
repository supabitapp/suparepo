import { normalizePath, proxyRequest } from "../_lib/proxy";

const DOWNLOADS_BASE =
  "https://github.com/supabitapp/supaimg/releases/download/";

export const onRequest = async (context: { request: Request; params: { path?: string | string[] } }) => {
  const path = normalizePath(context.params.path);
  if (!path) {
    return new Response("Not Found", { status: 404 });
  }
  return proxyRequest(context.request, `${DOWNLOADS_BASE}${path}`, {
    cacheTtl: 31536000,
    cacheEverything: true,
    cacheControl: "public, max-age=31536000, immutable",
  });
};
