import * as jestDom from "@testing-library/jest-dom/vitest";
import { randomFillSync } from "node:crypto";
import { clearMocks, mockWindows } from "@tauri-apps/api/mocks";
import * as React from "react";
import { afterEach, beforeAll, vi } from "vitest";

void jestDom;

const element =
  (tag: string) =>
  ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(tag, props, children);

vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: element("button"),
}));

vi.mock("@repo/ui/components/ui/card", () => ({
  Card: element("div"),
  CardContent: element("div"),
}));

vi.mock("@repo/ui/components/ui/checkbox", () => ({
  Checkbox: element("input"),
}));

vi.mock("@repo/ui/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  ContextMenuContent: () => null,
  ContextMenuItem: element("button"),
  ContextMenuTrigger: element("div"),
}));

vi.mock("@repo/ui/components/ui/progress", () => ({
  Progress: ({
    className,
    value,
    children,
    ...props
  }: {
    className?: string;
    value?: number | null;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "div",
      {
        role: "progressbar",
        className,
        "data-value": value ?? null,
        ...props,
      },
      children,
    ),
}));

vi.mock("@repo/ui/components/ui/select", () => ({
  Select: element("div"),
  SelectContent: element("div"),
  SelectItem: element("div"),
  SelectTrigger: element("button"),
  SelectValue: element("span"),
}));

vi.mock("@repo/ui/components/ui/slider", () => ({
  Slider: ({
    onValueChange: _onValueChange,
    value,
    className,
    children,
    ...props
  }: {
    onValueChange?: (value: number[] | number) => void;
    value?: number[] | number;
    className?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "div",
      {
        className,
        "data-value": Array.isArray(value) ? value.join(",") : value,
        ...props,
      },
      children,
    ),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  Toaster: element("div"),
}));

vi.mock("@repo/ui/components/ui/table", () => ({
  Table: element("table"),
  TableBody: element("tbody"),
  TableCaption: element("caption"),
  TableCell: element("td"),
  TableFooter: element("tfoot"),
  TableHead: element("th"),
  TableHeader: element("thead"),
  TableRow: element("tr"),
}));

vi.mock("@repo/ui/lib/toast", () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@repo/ui/lib/use-image-compare", () => ({
  useImageCompareDrag: () => ({
    containerRef: React.useRef<HTMLDivElement>(null),
    handleMouseDown: () => {},
    handleTouchStart: () => {},
    resetSplit: () => {},
  }),
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).flat().join(" "),
}));

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      getRandomValues: (buf: NodeJS.ArrayBufferView) => randomFillSync(buf),
      randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
    },
  });
  mockWindows("main");
});

afterEach(() => {
  clearMocks();
  vi.restoreAllMocks();
});
