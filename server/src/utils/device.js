/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – Sessions: readable device names
|--------------------------------------------------------------------------
| Turns the raw browser "User-Agent" text into a short label such as
| "Chrome 129 on Windows 10/11" or "Safari on iPhone", plus a device type
| (desktop / mobile / tablet) used by the Sessions filters.
| Pure function: no network lookups, nothing is sent anywhere.
*/

const BROWSERS = [
  // Order matters: Edge and Opera also contain "Chrome", Chrome contains "Safari".
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /(?:OPR|Opera)\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//]
];

function detectOs(agent) {
  if (/iPad/.test(agent)) return 'iPad';
  if (/iPhone/.test(agent)) return 'iPhone';
  if (/Android/.test(agent)) {
    const version = agent.match(/Android (\d+)/);
    return version ? `Android ${version[1]}` : 'Android';
  }
  if (/Windows NT 10\.0/.test(agent)) return 'Windows 10/11';
  if (/Windows NT 6\.3/.test(agent)) return 'Windows 8.1';
  if (/Windows NT 6\.1/.test(agent)) return 'Windows 7';
  if (/Windows/.test(agent)) return 'Windows';
  if (/CrOS/.test(agent)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/.test(agent)) return 'macOS';
  if (/Linux/.test(agent)) return 'Linux';
  return null;
}

function detectBrowser(agent) {
  for (const [name, pattern] of BROWSERS) {
    const match = agent.match(pattern);

    if (match) {
      return { name, version: match[1] };
    }
  }

  if (/Safari\//.test(agent) && /AppleWebKit/.test(agent)) {
    return { name: 'Safari', version: null };
  }

  if (/HeadlessChrome/.test(agent)) {
    return { name: 'Chrome (headless)', version: null };
  }

  if (/curl|wget|PostmanRuntime|node-fetch|axios|undici|supertest/i.test(agent)) {
    return { name: 'API client', version: null };
  }

  return null;
}

export function describeDevice(userAgent) {
  const agent = String(userAgent || '');

  if (!agent) {
    return { label: 'Unknown device', browser: null, os: null, type: 'desktop' };
  }

  const browser = detectBrowser(agent);
  const os = detectOs(agent);
  const type = /iPad|Tablet/.test(agent) ? 'tablet' : /Mobi|iPhone|Android.+Mobile/.test(agent) ? 'mobile' : 'desktop';

  const browserText = browser ? `${browser.name}${browser.version ? ` ${browser.version}` : ''}` : 'Browser';
  const label = os ? `${browserText} on ${os}` : browser ? browserText : 'Unknown device';

  return {
    label: label.slice(0, 120),
    browser: browser?.name || null,
    os,
    type
  };
}
