import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileList } from "@/components/file-list";
import { useStore } from "@/store";
import { makeFile, resetStore } from "@/test/test-helpers";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
}));

vi.mock("@/lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tauri")>("@/lib/tauri");
  return { ...actual, invokeCommand: vi.fn() };
});

describe("FileList", () => {
  beforeEach(() => {
    resetStore("macos");
  });

  test("opens image compare on clickable row", async () => {
    useStore.setState({
      filesById: {
        file: makeFile({
          id: "file",
          path: "/image.png",
          workflow: "compress",
          status: "done",
          originalSize: 1200,
          outputSize: 600,
          hasOutputCopy: true,
        }),
      },
      fileOrder: ["file"],
    });

    render(<FileList workflow="compress" />);

    const user = userEvent.setup();
    await user.click(screen.getByText("image.png"));

    expect(
      await screen.findByRole("dialog", { name: /image comparison/i }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
