export const getCurrentPath = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const getSafeNextPath = (candidate, fallback = '/') => {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  if (/^\/login(?:[/?#]|$)/.test(candidate)) {
    return fallback;
  }

  return candidate;
};

export const buildLoginRedirectPath = (candidate) => {
  const next = getSafeNextPath(candidate, '/');
  return `/login?next=${encodeURIComponent(next)}`;
};

export const redirectToPath = (path, { replace = false } = {}) => {
  if (replace) {
    window.location.replace(path);
    return;
  }

  window.location.assign(path);
};
