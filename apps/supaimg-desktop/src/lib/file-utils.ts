import { type ConvertOutputFormat, getWorkflow, type Workflow } from "@/lib/workflows";

const isRetinaSuffix = (value: string) => /^\d+x$/u.test(value) && /\d/u.test(value);

const getStem = (path: string) => {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
};

export function isSupportedPath(path: string, workflow: Workflow): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  const config = getWorkflow(workflow);
  return config.inputExtensions.includes(ext);
}

export function isOutputPath(path: string, workflow: Workflow): boolean {
  const stem = getStem(path).toLowerCase();
  const suffix = `_${getWorkflow(workflow).outputSuffix}`;
  if (stem.endsWith(suffix)) return true;
  const atPos = stem.lastIndexOf("@");
  if (atPos === -1) return false;
  const before = stem.slice(0, atPos);
  const after = stem.slice(atPos + 1);
  return before.endsWith(suffix) && isRetinaSuffix(after);
}

export function skipProcessingReason(
  path: string,
  workflow: Workflow,
  convertOutputFormat?: ConvertOutputFormat,
): string | undefined {
  if (isOutputPath(path, workflow)) {
    return "Already processed";
  }
  if (!isSupportedPath(path, workflow)) {
    return "Unsupported file type";
  }
  if (workflow === "convert" && convertOutputFormat) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext) {
      if (convertOutputFormat === "jpeg") {
        if (ext === "jpg" || ext === "jpeg") {
          return "Already in target format";
        }
      } else if (ext === convertOutputFormat) {
        return "Already in target format";
      }
    }
  }
  return undefined;
}

export function outputPath(path: string, workflow: Workflow, extensionOverride?: string): string {
  const config = getWorkflow(workflow);
  return outputPathWithSuffix(
    path,
    config.outputSuffix,
    extensionOverride ?? config.outputExtension,
  );
}

function outputPathWithSuffix(path: string, tag: string, extensionOverride?: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = extensionOverride ?? (dotIndex > 0 ? filename.slice(dotIndex + 1) : "");

  const atPos = stem.lastIndexOf("@");
  let name = "";
  if (atPos !== -1) {
    const atSuffix = stem.slice(atPos);
    const digit = atSuffix[1];
    if (atSuffix.length >= 2 && digit && /\d/.test(digit)) {
      name = `${stem.slice(0, atPos)}_${tag}${atSuffix}`;
    } else {
      name = `${stem}_${tag}`;
    }
  } else {
    name = `${stem}_${tag}`;
  }

  return ext ? `${dir}${name}.${ext}` : `${dir}${name}`;
}
