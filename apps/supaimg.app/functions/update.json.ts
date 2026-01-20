import { proxyRequest } from "./_lib/proxy";

const UPDATE_URL =
  "https://github.com/supabitapp/supaimg/releases/latest/download/update.json";

export const onRequest = async (context: { request: Request }) =>
  proxyRequest(context.request, UPDATE_URL, {
    cacheTtl: 60,
    cacheControl: "public, max-age=60",
  });
