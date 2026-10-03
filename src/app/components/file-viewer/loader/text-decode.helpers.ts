/**
 * Bytes → text: a BOM decides (UTF-8 / UTF-16 LE / BE); otherwise UTF-8 when the bytes are valid
 * UTF-8 (a character cut off at the end — a truncated preview — is tolerated), else windows-1252,
 * the usual encoding of CSVs saved by older Excel.
 */
export function decodeText(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));

  for (let trim = 0; trim < 4 && trim <= bytes.length; trim++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytes.length - trim));
      return new TextDecoder('utf-8').decode(bytes.subarray(0, bytes.length - trim));
    } catch {
      // maybe a multi-byte character cut off at the end — retry without the last byte(s)
    }
  }
  return new TextDecoder('windows-1252').decode(bytes);
}

/** A Blob's bytes — `Blob.arrayBuffer()`, or `FileReader` where that's missing (older engines, jsdom). */
export function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Reads at most `maxBytes` of `blob` as text; `truncated` tells whether there was more. */
export async function readText(
  blob: Blob,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const truncated = blob.size > maxBytes;
  const buffer = await readBlob(truncated ? blob.slice(0, maxBytes) : blob);
  return { text: decodeText(buffer), truncated };
}
