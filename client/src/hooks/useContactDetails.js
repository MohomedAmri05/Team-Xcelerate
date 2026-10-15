import { useApi } from './useApi';

/*
| Contact details come from the "contact" company-content record managed in
| the dashboard (body format: "address|phone|email|hours"). Nothing is
| invented: when a value is not configured, it is returned as null and
| the UI hides it.
*/

export function parseContactBody(body) {
  if (!body) {
    return null;
  }

  const parts = String(body)
    .split('|')
    .map((part) => part.trim());

  if (parts.length < 4) {
    return null;
  }

  const [address, phone, email, hours] = parts;

  return {
    address: address || null,
    phone: phone || null,
    email: email || null,
    hours: hours || null
  };
}

export function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');

  return digits ? `tel:${digits}` : null;
}

export function whatsappHref(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  // Sri Lankan local numbers (07x…) → international 947x…
  if (digits.startsWith('0')) {
    digits = `94${digits.slice(1)}`;
  }

  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function useContactDetails() {
  const { data, loading, error } = useApi('/content/contact');
  const details = parseContactBody(data?.body);

  return {
    title: data?.title || null,
    rawBody: data?.body || null,
    details,
    loading,
    error
  };
}
