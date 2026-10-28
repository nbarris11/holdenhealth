// Match actual scheduled classes in Eastern time, including daylight-saving changes.
export function weeklyClassTime(startsAt: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(new Date(startsAt));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.weekday} ${values.hour}:${values.minute} ${values.dayPeriod}`;
}
export function classConfirmationLine(meeting: { starts_at: string; is_zoom?: boolean }) {
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(meeting.starts_at));
  return `${when} Eastern${meeting.is_zoom ? ' · Zoom' : ''}`;
}
