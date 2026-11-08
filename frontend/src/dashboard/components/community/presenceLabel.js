export function peopleOnlineLabel(count) {
  const online = Math.max(0, Number(count) || 0);
  if (online === 1) return "1 person online";
  return `${online} people online`;
}
