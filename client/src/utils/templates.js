/*
| VIVA – Naaziq – Reply Templates: fills {{placeholders}} with real values.
| Unknown or empty values leave the placeholder visible so staff notice it.
*/
export function fillTemplate(text, values = {}) {
  return String(text || '').replace(/\{\{\s*(customer_name|reference|vehicle|staff_name)\s*\}\}/g, (match, key) => values[key] || match);
}
