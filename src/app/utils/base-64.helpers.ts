export function getBase64Object(base64: string): { extension?: string; uri: string } {
  return {
    extension: getExtensionFromBase64(base64),
    uri: (getHeaderFromBase64(base64) ?? '')?.concat(base64),
  };
}

export function getBase64Data(base64: string) {
  return getHeaderFromBase64(base64)?.concat(base64);
}

export function getHeaderFromBase64(base64: string) {
  const decodedData = atob(base64);
  const uint8Array = new Uint8Array(decodedData.length);
  for (let i = 0; i < decodedData.length; i++) uint8Array[i] = decodedData.charCodeAt(i);

  if (isPng(uint8Array)) return 'data:image/png;base64,';
  else if (isPdf(uint8Array)) return 'data:application/pdf;base64,';
  else if (isJpg(uint8Array)) return 'data:image/jpeg;base64,';
  else if (isGif(uint8Array)) return 'data:image/gif;base64,';
  else if (isWebp(uint8Array)) return 'data:image/webp;base64,';
  else if (isSvg(uint8Array)) return 'data:image/svg+xml;base64,';
  else return undefined;
}

export function getExtensionFromBase64(base64: string): string | undefined {
  const decodedData = atob(base64);
  const uint8Array = new Uint8Array(decodedData.length);
  for (let i = 0; i < decodedData.length; i++) uint8Array[i] = decodedData.charCodeAt(i);

  if (isPng(uint8Array)) return 'png';
  else if (isPdf(uint8Array)) return 'pdf';
  else if (isJpg(uint8Array)) return 'jpg';
  else if (isGif(uint8Array)) return 'gif';
  else if (isWebp(uint8Array)) return 'webp';
  else if (isSvg(uint8Array)) return 'svg';
  else return undefined;
}

function isPng(uint8Array: Uint8Array<ArrayBuffer>) {
  return (
    uint8Array.length > 3 &&
    uint8Array[0] === 0x89 &&
    uint8Array[1] === 0x50 &&
    uint8Array[2] === 0x4e &&
    uint8Array[3] === 0x47
  );
}

function isJpg(uint8Array: Uint8Array<ArrayBuffer>) {
  return (
    uint8Array.length > 2 &&
    uint8Array[0] === 0xff &&
    uint8Array[1] === 0xd8 &&
    uint8Array[uint8Array.length - 2] === 0xff &&
    uint8Array[uint8Array.length - 1] === 0xd9
  );
}

function isGif(uint8Array: Uint8Array<ArrayBuffer>) {
  return (
    uint8Array.length > 3 &&
    uint8Array[0] === 0x47 &&
    uint8Array[1] === 0x49 &&
    uint8Array[2] === 0x46 &&
    uint8Array[3] === 0x38
  );
}

function isWebp(uint8Array: Uint8Array<ArrayBuffer>) {
  return (
    uint8Array.length > 11 &&
    uint8Array[8] === 0x57 &&
    uint8Array[9] === 0x45 &&
    uint8Array[10] === 0x42 &&
    uint8Array[11] === 0x50
  );
}

function isPdf(uint8Array: Uint8Array<ArrayBuffer>) {
  return (
    uint8Array.length > 3 &&
    uint8Array[0] === 0x25 &&
    uint8Array[1] === 0x50 &&
    uint8Array[2] === 0x44 &&
    uint8Array[3] === 0x46
  );
}

function isSvg(uint8Array: Uint8Array<ArrayBuffer>) {
  const svgHeaders = ['<svg', '<?xml', '<!DOCTYPE svg'];
  const headerText = String.fromCharCode.apply(null, <any>uint8Array.subarray(0, 100));
  return svgHeaders.some((header) => headerText.includes(header));
}

export function isValidBase64(str: any) {
  let maxLength = 100;
  if (typeof str !== 'string') return false;
  if (str.trim().includes(' ') || str.length < maxLength) return false;

  try {
    return btoa(atob(str)) === str && /^[A-Za-z0-9+/=]+$/.test(str);
  } catch (err) {
    return false;
  }
}

/**
 * Convert blob to File
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

/**
 * Convert blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert blob to data URL (includes prefix like "data:image/png;base64,...")
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads a Blob object
 * @param blob - The Blob to download
 * @param filename - The name for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
