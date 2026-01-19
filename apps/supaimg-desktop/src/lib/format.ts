export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function calculateSavings(original: number, compressed: number): number {
  if (original <= 0) return 0;
  return ((original - compressed) / original) * 100;
}
