import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Route } from "@/routes/index";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => vi.fn() };
});

describe("HomePage", () => {
  test("shows feature tiles", () => {
    const Component = Route.options.component;
    render(<Component />);
    expect(screen.getByRole("heading", { name: /compress image/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /resize image/i })).toBeInTheDocument();
  });

  test("marks coming soon features", () => {
    const Component = Route.options.component;
    render(<Component />);
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
  });
});
