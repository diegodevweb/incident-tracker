import { detectImageType } from './detect-image-type';

describe('detectImageType', () => {
  it('detects PNG by its signature', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
    ]);

    expect(detectImageType(png)).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
  });

  it('detects JPEG by its signature', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

    expect(detectImageType(jpeg)).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('rejects HTML even when it is sent as image/png', () => {
    expect(
      detectImageType(Buffer.from('<html><script>alert(1)</script>')),
    ).toBe(null);
  });

  it('rejects SVG', () => {
    expect(
      detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBe(null);
  });

  it('rejects a truncated signature and an empty buffer', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e]))).toBe(null);
    expect(detectImageType(Buffer.alloc(0))).toBe(null);
  });
});
