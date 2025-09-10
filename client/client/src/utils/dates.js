// src/utils/dates.js
export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata', // keep/localize as you like
  });
}

export function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata', // keep/localize as you like
  });
}
