const VERSION_PARAM = 'v';

function normalizeVersion(version: unknown) {
  if (version instanceof Date) {
    return String(version.getTime());
  }

  if (typeof version === 'number' && Number.isFinite(version)) {
    return String(Math.trunc(version));
  }

  if (typeof version === 'string') {
    const trimmed = version.trim();
    if (!trimmed) return '';

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return String(parsed);
    }

    return trimmed.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  }

  return '';
}

export function imageVersionFromUpdatedAt(updatedAt: unknown) {
  return normalizeVersion(updatedAt);
}

export function imageVersionFromSources(values: unknown[]) {
  const source = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('|');

  if (!source) return '';

  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function withPublicImageVersion(url: unknown, version: unknown) {
  if (typeof url !== 'string') return '';

  const trimmed = url.trim();
  const normalizedVersion = normalizeVersion(version);

  if (
    !trimmed ||
    !normalizedVersion ||
    /^(blob|data):/i.test(trimmed)
  ) {
    return trimmed;
  }

  try {
    const parsed = trimmed.startsWith('/')
      ? new URL(trimmed, 'https://zylo-buylo.local')
      : new URL(trimmed);
    parsed.searchParams.set(VERSION_PARAM, normalizedVersion);

    return trimmed.startsWith('/')
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return trimmed;
  }
}

export function versionPublicImageList(images: unknown, version: unknown) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => withPublicImageVersion(image, version))
    .filter(Boolean);
}

export function latestCatalogueVersion(values: unknown[]) {
  const versions = values
    .map(imageVersionFromUpdatedAt)
    .filter(Boolean);

  if (!versions.length) return '';

  const numericVersions = versions
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (numericVersions.length === versions.length) {
    return String(Math.max(...numericVersions));
  }

  return versions.sort().at(-1) || '';
}
