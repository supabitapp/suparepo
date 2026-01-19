import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const eventsPath = resolve(root, "events.json");
const outPath = resolve(root, "src", "generated.ts");

const eventsFile = JSON.parse(readFileSync(eventsPath, "utf8"));

const normalizePayload = (payload) => {
  const next = {};
  for (const [rawKey, type] of Object.entries(payload ?? {})) {
    const key = rawKey.endsWith("?") ? rawKey.slice(0, -1) : rawKey;
    next[key] = type;
  }
  return next;
};

const collectOptionalFields = (payload) => {
  const optional = [];
  for (const rawKey of Object.keys(payload ?? {})) {
    if (rawKey.endsWith("?")) {
      optional.push(rawKey.slice(0, -1));
    }
  }
  return optional;
};

const normalizedEvents = {
  events: (eventsFile.events ?? []).map((event) => ({
    name: event.name,
    payload: normalizePayload(event.payload)
  }))
};

const optionalPayloadFields = Object.fromEntries(
  (eventsFile.events ?? []).map((event) => [
    event.name,
    collectOptionalFields(event.payload)
  ])
);

const lines = [
  `export const events = ${JSON.stringify(normalizedEvents, null, 2)} as const;`,
  "",
  `const optionalPayloadFields = ${JSON.stringify(optionalPayloadFields, null, 2)} as const;`,
  "",
  "type OptionalPayloadFieldMap = typeof optionalPayloadFields;",
  "",
  "type PayloadTypeMap = {",
  "  string: string;",
  "  number: number;",
  "  boolean: boolean;",
  "  \"string[]\": string[];",
  "  \"number[]\": number[];",
  "  \"boolean[]\": boolean[];",
  "};",
  "",
  "export type AnalyticsEventName = (typeof events.events)[number][\"name\"];",
  "",
  "type PayloadSchema<E extends AnalyticsEventName> = Extract<",
  "  (typeof events.events)[number],",
  "  { name: E }",
  ">[\"payload\"];",
  "",
  "type PayloadFieldType<T> = T extends keyof PayloadTypeMap",
  "  ? PayloadTypeMap[T]",
  "  : never;",
  "",
  "type OptionalFields<E extends AnalyticsEventName> = E extends keyof OptionalPayloadFieldMap",
  "  ? OptionalPayloadFieldMap[E][number]",
  "  : never;",
  "",
  "type RequiredFields<E extends AnalyticsEventName> = Exclude<",
  "  keyof PayloadSchema<E>,",
  "  OptionalFields<E>",
  ">;",
  "",
  "export type AnalyticsEventPayload<E extends AnalyticsEventName> = {",
  "  [K in RequiredFields<E>]: PayloadFieldType<PayloadSchema<E>[K]>;",
  "} & {",
  "  [K in OptionalFields<E>]?: PayloadFieldType<PayloadSchema<E>[K]>;",
  "};",
  ""
];

writeFileSync(outPath, `${lines.join("\n")}\n`);
