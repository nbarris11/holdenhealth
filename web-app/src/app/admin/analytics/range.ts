const detroitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
});
const detroitOffset = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Detroit", timeZoneName: "shortOffset",
});

function dateParts(date: Date): string {
  const parts = Object.fromEntries(detroitDate.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function detroitMidnight(value: string): Date {
  // 05:00 UTC is at or just after local midnight in Detroit, including DST change days.
  const probe = new Date(`${value}T05:00:00Z`);
  const zone = detroitOffset.formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
  if (!match) throw new Error("Could not determine Detroit time offset");
  const minutes = (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "+" ? 1 : -1);
  return new Date(Date.parse(`${value}T00:00:00Z`) - minutes * 60_000);
}

function nextDate(value: string): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function resolveAnalyticsRange(params: Record<string, string | string[] | undefined>, now = new Date()) {
  const today = dateParts(now);
  const requestedStart = params.start;
  const requestedEnd = params.end;
  const hasCustomDates = requestedStart !== undefined || requestedEnd !== undefined;
  if (validDate(requestedStart) && validDate(requestedEnd)) {
    const duration = Date.parse(`${requestedEnd}T00:00:00Z`) - Date.parse(`${requestedStart}T00:00:00Z`);
    if (duration >= 0 && duration < 366 * 86_400_000 && requestedEnd <= today) {
      return {
        start: detroitMidnight(requestedStart), end: detroitMidnight(nextDate(requestedEnd)),
        startDate: requestedStart, endDate: requestedEnd, today, selected: "custom" as const, invalid: false,
      };
    }
  }
  if (params.hours === "24" && !hasCustomDates) {
    return {
      start: new Date(now.getTime() - 24 * 60 * 60_000), end: now,
      startDate: "", endDate: "", today, selected: "24h" as const, invalid: false,
    };
  }
  const days = params.days === "90" ? 90 : params.days === "30" ? 30 : 7;
  return {
    start: new Date(now.getTime() - days * 86_400_000), end: now,
    startDate: validDate(requestedStart) ? requestedStart : "",
    endDate: validDate(requestedEnd) ? requestedEnd : "",
    today, selected: days, invalid: hasCustomDates,
  };
}
