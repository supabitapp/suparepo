import { open } from "@tauri-apps/plugin-dialog";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DropZone } from "@/components/drop-zone";
import { useStore } from "@/store";
import { resetStore } from "@/test/test-helpers";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

describe("DropZone", () => {
  beforeEach(() => {
    resetStore();
  });

  test("select files sends to store", async () => {
    const addFiles = vi.fn();
    useStore.setState({ addFiles });
    vi.mocked(open).mockResolvedValue(["/a.png", "/b.png"]);

    render(<DropZone workflow="compress" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /select files/i }));

    expect(addFiles).toHaveBeenCalledWith("compress", ["/a.png", "/b.png"]);
  });
});
