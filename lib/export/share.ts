import LZString from "lz-string";

/**
 * Compress spec text into a URL-safe encoded string using lz-string.
 *
 * @returns The compressed string, or null if compression fails.
 */
export function compressSpec(specText: string): string | null {
  return LZString.compressToEncodedURIComponent(specText);
}

/**
 * Decompress a URL-safe encoded string back to spec text.
 *
 * @returns The decompressed spec text, or null if decompression fails.
 */
export function decompressSpec(compressed: string): string | null {
  return LZString.decompressFromEncodedURIComponent(compressed);
}
