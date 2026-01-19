import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Toolbar } from "@/components/toolbar";
import { useStore } from "@/store";
import { makeFile, resetStore } from "@/test/test-helpers";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("Toolbar", () => {
  beforeEach(() => {
    resetStore();
  });

  test("shows stats and clears all", async () => {
    useStore.setState({
      filesById: {
        done: makeFile({
          id: "done",
          path: "/done.png",
          workflow: "compress",
          status: "done",
          originalSize: 1000,
          outputSize: 500,
        }),
        pending: makeFile({
          id: "pending",
          path: "/pending.png",
          workflow: "compress",
          status: "pending",
          originalSize: 0,
        }),
      },
      fileOrder: ["done", "pending"],
    });

    render(<Toolbar workflow="compress" />);

    expect(screen.getByText(/2 files/i)).toBeInTheDocument();

    const clearButton = screen.getByRole("button", {
      name: /clear all/i,
    });
    expect(clearButton).toBeEnabled();

    const user = userEvent.setup();
    await user.click(clearButton);

    expect(useStore.getState().fileOrder).toEqual([]);
  });
});
