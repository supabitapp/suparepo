import PQueue from "p-queue";
import type { Workflow } from "@/lib/workflows";
import { detectConcurrency } from "./index";

export type ProcessingTask = {
  id: string;
  path: string;
  workflow: Workflow;
};

type TaskSchedulerOptions<Result> = {
  concurrency?: number;
  maxQueued?: number;
  getTask: (id: string) => ProcessingTask | null;
  runTask: (task: ProcessingTask) => Promise<Result>;
  onStart: (id: string) => void;
  onSuccess: (id: string, result: Result) => void;
  onError: (id: string, error: unknown) => void;
};

export const defaultMaxQueued = (concurrency: number) => Math.max(8, concurrency * 2);

export const resolveQueueConfig = (options: { concurrency?: number; maxQueued?: number }) => {
  const concurrency = options.concurrency ?? detectConcurrency();
  const maxQueued = options.maxQueued ?? defaultMaxQueued(concurrency);
  return { concurrency, maxQueued };
};

export function createTaskScheduler<Result>(options: TaskSchedulerOptions<Result>) {
  const { concurrency, maxQueued } = resolveQueueConfig(options);
  const queue = new PQueue({ concurrency });
  const pendingIds: string[] = [];

  const pumpQueue = () => {
    while (pendingIds.length > 0 && queue.size + queue.pending < maxQueued) {
      const id = pendingIds.shift();
      if (id) {
        void enqueueTask(id);
      }
    }
  };

  const enqueueTask = (id: string) => {
    const task = options.getTask(id);
    if (!task) {
      return Promise.resolve();
    }
    options.onStart(id);

    return queue
      .add(() => options.runTask(task))
      .then((result) => {
        options.onSuccess(id, result);
      })
      .catch((err) => {
        options.onError(id, err);
      })
      .finally(() => {
        pumpQueue();
      });
  };

  const enqueueId = (id: string) => {
    pendingIds.push(id);
    pumpQueue();
  };

  return { enqueueId };
}
