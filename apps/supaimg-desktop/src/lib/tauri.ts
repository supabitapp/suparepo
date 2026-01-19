import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { COMMANDS as COMMAND_NAMES, EVENTS as EVENT_NAMES } from "./tauri.manifest";

type StripPrefix<S extends string> = S extends `tauri://${infer Rest}` ? Rest : S;

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<CamelCase<Tail>>}`
    : S;

export type CommandName = (typeof COMMAND_NAMES)[number];
export type EventName = (typeof EVENT_NAMES)[number];

type CommandKey = CamelCase<CommandName>;
type EventKey = CamelCase<StripPrefix<EventName>>;

type CommandMap = { [Key in CommandKey]: CommandName };
type EventMap = { [Key in EventKey]: EventName };

const toCamelKey = (value: string) => {
  const normalized = value.startsWith("tauri://") ? value.slice("tauri://".length) : value;
  return normalized.replace(/[-_]+(.)?/g, (_, chr: string | undefined) =>
    chr ? chr.toUpperCase() : "",
  );
};

export const COMMANDS = Object.fromEntries(
  COMMAND_NAMES.map((command) => [toCamelKey(command), command]),
) as CommandMap;

export const EVENTS = Object.fromEntries(
  EVENT_NAMES.map((event) => [toCamelKey(event), event]),
) as EventMap;

export const isTauri = () =>
  typeof window !== "undefined" &&
  typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke ===
    "function";

export const invokeCommand = <T>(command: CommandName, payload?: Record<string, unknown>) =>
  payload ? invoke<T>(command, payload) : invoke<T>(command);

export const listenEvent = <T>(event: EventName, handler: (payload: T) => void) =>
  listen<T>(event, (evt) => handler(evt.payload));

export const autostart = {
  enable: enableAutostart,
  disable: disableAutostart,
  isEnabled: isAutostartEnabled,
};
