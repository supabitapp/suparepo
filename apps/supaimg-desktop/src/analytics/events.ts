import schema from "./events.json";

type EventSchema = typeof schema;

export type PosthogEventName = keyof EventSchema["events"];

const eventDefinitions = schema.events;
const workflowDefinitions = schema.workflowProperties;

const allowedPropertiesByEvent = Object.fromEntries(
  Object.entries(eventDefinitions).map(([name, def]) => [
    name,
    new Set([...def.required, ...def.optional]),
  ]),
) as Record<PosthogEventName, Set<string>>;

export const isPosthogEventName = (name: string): name is PosthogEventName =>
  name in eventDefinitions;

export const sanitizeEventProperties = (
  name: PosthogEventName,
  properties: Record<string, unknown> | null | undefined,
) => {
  const allowed = allowedPropertiesByEvent[name];
  const sanitized: Record<string, unknown> = {};
  if (!properties) return sanitized;
  for (const [key, value] of Object.entries(properties)) {
    if (allowed.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const analyticsSchema = {
  events: eventDefinitions,
  workflowProperties: workflowDefinitions,
};
