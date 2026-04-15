export const buildOrderLookupPath = ({ number, accessId = '' }) => {
  const safeNumber = encodeURIComponent(String(number ?? '').trim());
  const safeAccessId = String(accessId ?? '').trim();

  if (!safeNumber) {
    return '/console/order-lookup';
  }

  const query = safeAccessId ? `?id=${encodeURIComponent(safeAccessId)}` : '';
  return `/console/order-lookup/${safeNumber}${query}`;
};

export const buildCollectionQrUrl = ({ origin, number, accessId = '' }) => {
  const path = buildOrderLookupPath({ number, accessId });
  return origin ? `${origin}${path}` : path;
};

const toUrlCandidates = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return [];
  }

  const candidates = [trimmed];
  if (trimmed.startsWith('/')) {
    candidates.push(`https://scanner.local${trimmed}`);
  }

  return candidates;
};

export const parseCollectionQrValue = (value) => {
  for (const candidate of toUrlCandidates(value)) {
    try {
      const url = new URL(candidate);
      const pathname = url.pathname.replace(/\/+$/, '');
      const match = pathname.match(/\/console\/order-lookup\/([^/]+)$/);

      if (!match) {
        continue;
      }

      return {
        number: decodeURIComponent(match[1]),
        accessId: url.searchParams.get('id') || '',
      };
    } catch {
      // Ignore malformed URL candidates and continue trying fallbacks.
    }
  }

  return null;
};
