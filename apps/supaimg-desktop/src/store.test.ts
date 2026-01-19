import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultSettings } from "@/lib/settings";
import { COMMANDS } from "@/lib/tauri";

vi.mock("@tauri-apps/plugin-log", () => ({ error: vi.fn() }));

describe("store", () => {
  beforeEach(async () => {
    // Reset store between tests
    const { useStore } = await import("./store");
    useStore.setState({
      filesById: {},
      fileOrder: [],
      settings: createDefaultSettings(),
      cachedUpdateVersion: null,
      installingUpdateVersion: null,
    });

    mockIPC((cmd) => {
      if (cmd === COMMANDS.processFile) {
        return { original_size: 1000, output_size: 800, format: "png" };
      }
    });
  });

  test("addFiles deduplicates paths", async () => {
    const { useStore } = await import("./store");
    useStore.getState().addFiles("compress", ["/a.png", "/b.png", "/a.png"]);
    expect(useStore.getState().fileOrder).toHaveLength(2);
  });

  test("addFiles marks unsupported extensions as skipped", async () => {
    const { useStore } = await import("./store");
    useStore.getState().addFiles("compress", ["/a.png", "/b.gif", "/c.txt"]);
    expect(useStore.getState().fileOrder).toHaveLength(3);
    const skipped = Object.values(useStore.getState().filesById).find(
      (file) => file.path === "/c.txt",
    );
    expect(skipped?.status).toBe("skipped");
    expect(skipped?.skipReason).toBe("Unsupported file type");
  });

  test("addFiles marks output-suffixed files as skipped", async () => {
    const { useStore } = await import("./store");
    useStore.getState().addFiles("compress", ["/a.png", "/b_compressed.png"]);
    expect(useStore.getState().fileOrder).toHaveLength(2);
    const file = Object.values(useStore.getState().filesById).find(
      (entry) => entry.path === "/b_compressed.png",
    );
    expect(file?.status).toBe("skipped");
    expect(file?.skipReason).toBe("Already processed");
  });

  test("addFiles marks convert same-format as skipped", async () => {
    const { useStore } = await import("./store");
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        workflowSettings: {
          ...state.settings.workflowSettings,
          convert: {
            ...state.settings.workflowSettings.convert,
            outputFormat: "png",
          },
        },
      },
    }));
    useStore.getState().addFiles("convert", ["/a.png", "/b.jpg"]);
    const skipped = Object.values(useStore.getState().filesById).find(
      (file) => file.path === "/a.png",
    );
    expect(skipped?.status).toBe("skipped");
    expect(skipped?.skipReason).toBe("Already in target format");
  });

  test("addFiles allows same path for different convert formats", async () => {
    const { useStore } = await import("./store");
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        workflowSettings: {
          ...state.settings.workflowSettings,
          convert: {
            ...state.settings.workflowSettings.convert,
            outputFormat: "png",
          },
        },
      },
    }));
    useStore.getState().addFiles("convert", ["/a.jpg"]);
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        workflowSettings: {
          ...state.settings.workflowSettings,
          convert: {
            ...state.settings.workflowSettings.convert,
            outputFormat: "webp",
          },
        },
      },
    }));
    useStore.getState().addFiles("convert", ["/a.jpg"]);
    expect(useStore.getState().fileOrder).toHaveLength(2);
    const formats = Object.values(useStore.getState().filesById).map((file) => file.outputFormat);
    expect(formats).toContain("png");
    expect(formats).toContain("webp");
  });

  test("convert uses per-file options snapshot", async () => {
    let lastArgs: {
      options?: { outputFormat?: string; jpegQuality?: number };
    } = {};
    mockIPC((cmd, args) => {
      if (cmd === COMMANDS.processFile) {
        lastArgs = args as typeof lastArgs;
        return { original_size: 1000, output_size: 800, format: "png" };
      }
    });
    const { useStore } = await import("./store");
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        workflowSettings: {
          ...state.settings.workflowSettings,
          convert: {
            ...state.settings.workflowSettings.convert,
            outputFormat: "png",
            jpegQuality: 88,
          },
        },
      },
    }));
    useStore.getState().addFiles("convert", ["/a.jpg"]);
    const id = useStore.getState().fileOrder[0];
    useStore.setState((state) => ({
      settings: {
        ...state.settings,
        workflowSettings: {
          ...state.settings.workflowSettings,
          convert: {
            ...state.settings.workflowSettings.convert,
            outputFormat: "webp",
            jpegQuality: 60,
          },
        },
      },
    }));
    await useStore.getState().compressFile(id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastArgs.options?.outputFormat).toBe("png");
    expect(lastArgs.options?.jpegQuality).toBe(88);
  });

  test("clearAll removes everything except processing", async () => {
    const { useStore } = await import("./store");
    useStore.setState({
      filesById: {
        "1": {
          id: "1",
          path: "/a.png",
          name: "a.png",
          workflow: "compress",
          originalSize: 0,
          status: "done",
        },
        "2": {
          id: "2",
          path: "/b.png",
          name: "b.png",
          workflow: "compress",
          originalSize: 0,
          status: "pending",
        },
        "3": {
          id: "3",
          path: "/c.png",
          name: "c.png",
          workflow: "compress",
          originalSize: 0,
          status: "skipped",
        },
        "4": {
          id: "4",
          path: "/d.png",
          name: "d.png",
          workflow: "compress",
          originalSize: 0,
          status: "processing",
        },
      },
      fileOrder: ["1", "2", "3", "4"],
    });
    useStore.getState().clearAll("compress");
    expect(useStore.getState().fileOrder).toHaveLength(1);
    const remainingId = useStore.getState().fileOrder[0];
    expect(useStore.getState().filesById[remainingId].status).toBe("processing");
  });

  test("clearAll keeps other workflows intact", async () => {
    const { useStore } = await import("./store");
    useStore.setState({
      filesById: {
        "1": {
          id: "1",
          path: "/a.png",
          name: "a.png",
          workflow: "compress",
          originalSize: 0,
          status: "done",
        },
        "2": {
          id: "2",
          path: "/b.png",
          name: "b.png",
          workflow: "convert",
          originalSize: 0,
          status: "pending",
        },
      },
      fileOrder: ["1", "2"],
    });
    useStore.getState().clearAll("compress");
    expect(useStore.getState().fileOrder).toHaveLength(1);
    const remainingId = useStore.getState().fileOrder[0];
    expect(useStore.getState().filesById[remainingId].workflow).toBe("convert");
  });
});
