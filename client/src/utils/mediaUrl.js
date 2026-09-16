const apiUrl =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api/v1';

const serverUrl =
  apiUrl.replace(
    /\/api\/v1\/?$/,
    ''
  );

export function mediaUrl(url) {
  if (!url) {
    return '/fallback-car.svg';
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }

  if (url.startsWith('/uploads/')) {
    return `${serverUrl}${url}`;
  }

  return url;
}