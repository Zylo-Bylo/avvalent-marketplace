import { describe, expect, it, vi } from 'vitest';
import {
  imageVersionFromUpdatedAt,
  versionPublicImageList,
  withPublicImageVersion,
} from '@/lib/public-image-version';

describe('public image versioning', () => {
  it('adds a deterministic version query from updatedAt', () => {
    const updatedAt = '2026-08-23T10:00:00.000Z';
    const url = 'https://storage.example.com/product/image.webp';

    expect(withPublicImageVersion(url, updatedAt)).toBe(
      'https://storage.example.com/product/image.webp?v=1787479200000',
    );
    expect(withPublicImageVersion(url, updatedAt)).toBe(
      withPublicImageVersion(url, updatedAt),
    );
  });

  it('changes the effective URL when the record version changes', () => {
    const url = 'https://storage.example.com/category/banner.png?width=900';

    expect(withPublicImageVersion(url, '2026-08-23T10:00:00.000Z')).not.toBe(
      withPublicImageVersion(url, '2026-08-23T10:01:00.000Z'),
    );
  });

  it('does not use wall-clock time for render cache busting', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(123);
    const url = withPublicImageVersion(
      'https://storage.example.com/category/icon.png',
      '2026-08-23T10:00:00.000Z',
    );

    expect(url).not.toContain('123');
    expect(imageVersionFromUpdatedAt('2026-08-23T10:00:00.000Z')).toBe(
      '1787479200000',
    );
    now.mockRestore();
  });

  it('supports manual URL invalidation through updatedAt version changes', () => {
    const manualUrl = 'https://cdn.example.com/manual/category.png';
    const first = withPublicImageVersion(manualUrl, '2026-08-23T10:00:00.000Z');
    const second = withPublicImageVersion(manualUrl, '2026-08-23T10:05:00.000Z');

    expect(first).toBe('https://cdn.example.com/manual/category.png?v=1787479200000');
    expect(second).toBe('https://cdn.example.com/manual/category.png?v=1787479500000');
  });

  it('does not rewrite temporary or empty image values', () => {
    expect(withPublicImageVersion('blob:https://zylo-buylo.com/abc', 'v1')).toBe(
      'blob:https://zylo-buylo.com/abc',
    );
    expect(versionPublicImageList(['', null, 'data:image/png;base64,abc'], 'v1')).toEqual([
      'data:image/png;base64,abc',
    ]);
  });
});
