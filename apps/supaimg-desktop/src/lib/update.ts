import { error, info } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { COMMANDS, invokeCommand, isTauri } from "@/lib/tauri";

type CachedUpdate = {
  version: string;
  currentVersion: string;
};

let downloading = false;
let installing = false;

export const downloadUpdateToCache = async (): Promise<string | null> => {
  if (import.meta.env.DEV || !isTauri() || downloading || installing) return null;
  downloading = true;
  try {
    const update = await invokeCommand<CachedUpdate | null>(COMMANDS.downloadUpdateToCache);
    if (update?.version) {
      info(`update cached: ${update.version}`);
    }
    return update?.version ?? null;
  } catch (e) {
    error(`update cache download failed: ${String(e)}`);
    return null;
  } finally {
    downloading = false;
  }
};

export const installCachedUpdate = async (version: string): Promise<void> => {
  if (import.meta.env.DEV || !isTauri() || installing) return;
  installing = true;
  try {
    await invokeCommand(COMMANDS.installCachedUpdate, { version });
    await relaunch();
  } catch (e) {
    error(`cached update install failed: ${String(e)}`);
    throw e;
  } finally {
    installing = false;
  }
};

export const getCachedUpdateVersion = async (): Promise<string | null> => {
  if (import.meta.env.DEV || !isTauri()) return null;
  try {
    return await invokeCommand<string | null>(COMMANDS.getCachedUpdateVersion);
  } catch (e) {
    error(`cached update lookup failed: ${String(e)}`);
    return null;
  }
};

export const clearUpdateCache = async (): Promise<void> => {
  if (import.meta.env.DEV || !isTauri()) return;
  try {
    await invokeCommand(COMMANDS.clearUpdateCache);
  } catch (e) {
    error(`update cache clear failed: ${String(e)}`);
  }
};
