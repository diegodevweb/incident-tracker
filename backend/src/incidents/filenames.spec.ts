import { truncateFilename } from './filenames';

describe('truncateFilename', () => {
  it('keeps short names untouched', () => {
    expect(truncateFilename('print.png', 100)).toBe('print.png');
  });

  it('shortens long names and keeps the extension', () => {
    const result = truncateFilename(`${'a'.repeat(300)}.png`, 100);

    expect(result).toHaveLength(100);
    expect(result.endsWith('.png')).toBe(true);
  });

  it('drops an absurdly long extension instead of keeping it', () => {
    const result = truncateFilename(`file.${'x'.repeat(300)}`, 50);

    expect(result).toHaveLength(50);
  });
});
