import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ProgressView } from "@/components/progress-view";

describe("ProgressView", () => {
  test("shows label", () => {
    render(<ProgressView label="Downloading models" progress={40} />);
    expect(screen.getByText(/downloading models/i)).toBeInTheDocument();
  });
});
