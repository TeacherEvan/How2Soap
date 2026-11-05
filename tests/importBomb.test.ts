import { describe, it, expect } from 'vitest';
import { decompressBase64ToSave } from '../src/engine/persistence';

describe('Gzip Decompression Limit (MVTH-8 / P1-9)', () => {
  it('rejects decompressed payloads exceeding the 5 MB safety limit safely', async () => {
    // Generate a payload that decompresses to > 5 MB
    const largeSize = 6 * 1024 * 1024; // 6 MB
    const largeData = new Uint8Array(largeSize);
    // Fill with ascii text for valid json-like content
    largeData.fill(32); // spaces

    // Compress using CompressionStream
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(largeData);
    writer.close();
    const compressedBuffer = await new Response(cs.readable).arrayBuffer();

    let binary = '';
    const bytes = new Uint8Array(compressedBuffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    await expect(decompressBase64ToSave(base64)).rejects.toThrow(/exceeds 5MB limit/);
  });
});
