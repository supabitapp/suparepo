import { describe, expect, test } from "vitest";
import type { Workflow } from "@/lib/workflows";
import fixtures from "../../output-path-fixtures.json";
import {
  fileNameFromPath,
  isOutputPath,
  isSupportedPath,
  outputPath,
  skipProcessingReason,
} from "./file-utils";

describe("isSupportedPath", () => {
  test("accepts supported", () => {
    expect(isSupportedPath("/test.png", "compress")).toBe(true);
    expect(isSupportedPath("/test.gif", "compress")).toBe(true);
    expect(isSupportedPath("/test.webp", "convert")).toBe(true);
    expect(isSupportedPath("/test.jpg", "convert")).toBe(true);
  });
  test("rejects unsupported", () => {
    expect(isSupportedPath("/test.psd", "compress")).toBe(false);
    expect(isSupportedPath("/test", "compress")).toBe(false);
    expect(isSupportedPath("/test.psd", "convert")).toBe(false);
  });
});

describe("isOutputPath", () => {
  test("detects _compressed suffix", () => {
    expect(isOutputPath("/path/file_compressed.png", "compress")).toBe(true);
    expect(isOutputPath("/path/file_compressed@2x.png", "compress")).toBe(true);
  });
  test("passes normal files", () => {
    expect(isOutputPath("/path/file.png", "compress")).toBe(false);
    expect(isOutputPath("/path/compressed_file.png", "compress")).toBe(false);
  });
  test("detects _converted suffix", () => {
    expect(isOutputPath("/path/file_converted.jpg", "convert")).toBe(true);
    expect(isOutputPath("/path/file_converted@3x.jpg", "convert")).toBe(true);
  });
});

describe("skipProcessingReason", () => {
  test("skips unsupported files", () => {
    expect(skipProcessingReason("/path/file.psd", "compress")).toBe("Unsupported file type");
  });

  test("skips output-suffixed files", () => {
    expect(skipProcessingReason("/path/file_compressed.png", "compress")).toBe("Already processed");
  });

  test("skips convert when already in target format", () => {
    expect(skipProcessingReason("/path/file.png", "convert", "png")).toBe(
      "Already in target format",
    );
    expect(skipProcessingReason("/path/file.jpg", "convert", "jpeg")).toBe(
      "Already in target format",
    );
    expect(skipProcessingReason("/path/file.jpeg", "convert", "jpeg")).toBe(
      "Already in target format",
    );
  });

  test("does not skip convert when format differs", () => {
    expect(skipProcessingReason("/path/file.png", "convert", "jpeg")).toBe(undefined);
  });
});

describe("outputPath", () => {
  const typedFixtures = fixtures as {
    path: string;
    workflow: Workflow;
    extensionOverride?: string;
    output: string;
  }[];

  for (const fixture of typedFixtures) {
    test(`${fixture.workflow} ${fixture.path}`, () => {
      expect(outputPath(fixture.path, fixture.workflow, fixture.extensionOverride)).toBe(
        fixture.output,
      );
    });
  }
});

describe("fileNameFromPath", () => {
  test("handles posix and windows separators", () => {
    expect(fileNameFromPath("/path/to/file.png")).toBe("file.png");
    expect(fileNameFromPath("C:\\images\\file.png")).toBe("file.png");
    expect(fileNameFromPath("file.png")).toBe("file.png");
  });
});
