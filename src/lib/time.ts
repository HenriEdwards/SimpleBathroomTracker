function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatTime(ts: number, mode: '24h' | '12h'): string {
  const date = new Date(ts);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (mode === '24h') {
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad2(minutes)} ${suffix}`;
}

export function formatDate(ts: number): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function formatDateTime(ts: number, mode: '24h' | '12h'): string {
  return `${formatDate(ts)} ${formatTime(ts, mode)}`;
}
