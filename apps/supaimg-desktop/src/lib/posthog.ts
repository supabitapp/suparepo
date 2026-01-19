import { error as logError } from "@tauri-apps/plugin-log";
import { captureEvent } from "tauri-plugin-better-posthog";
import { isPosthogEventName, sanitizeEventProperties } from "@/analytics/events";
import { isTauri } from "@/lib/tauri";

type PosthogClient = (typeof import("posthog-js"))["default"];

let posthogClient: PosthogClient | null = null;
let initPromise: Promise<void> | null = null;
let initialized = false;
let pendingEnabled: boolean | null = null;

const loadPosthog = async (): Promise<PosthogClient> => {
  if (posthogClient) return posthogClient;
  const mod = await import("posthog-js");
  posthogClient = mod.default;
  return posthogClient;
};

const ensureInit = async () => {
  if (initialized || !isTauri()) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const client = await loadPosthog();
    client.init("dummy_api_key", {
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      advanced_disable_flags: true,
      before_send: [
        (captureResult) => {
          if (captureResult) {
            const { event, properties } = captureResult;
            if (!isPosthogEventName(event)) {
              void logError(`[posthog] unknown event: ${event}`);
              return null;
            }
            const sanitized = sanitizeEventProperties(event, properties as Record<string, unknown>);
            void captureEvent(event, sanitized).catch((err) => {
              void logError(`[posthog] capture failed: ${String(err)}`);
            });
          }
          return null;
        },
      ],
    });
    initialized = true;
    if (pendingEnabled !== null) {
      if (pendingEnabled) {
        client.opt_in_capturing();
      } else {
        client.opt_out_capturing();
      }
      pendingEnabled = null;
    } else {
      client.opt_out_capturing();
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
};

export const initPosthog = async () => {
  if (pendingEnabled === true) {
    try {
      await ensureInit();
    } catch (err) {
      void logError(`[posthog] init failed: ${String(err)}`);
    }
  }
};

export const setPosthogEnabled = (enabled: boolean) => {
  pendingEnabled = enabled;
  if (!initialized) {
    if (enabled) {
      void ensureInit().catch((err) => {
        void logError(`[posthog] init failed: ${String(err)}`);
      });
    }
    return;
  }
  if (!posthogClient) return;
  if (enabled) {
    posthogClient.opt_in_capturing();
  } else {
    posthogClient.opt_out_capturing();
  }
};
