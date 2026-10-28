function calendarTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function consultationCalendarInvite(bookingId: string, fullName: string, startsAt: string, durationMinutes: number, zoomJoinUrl: string) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Holden Health//Zoom Consultation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${bookingId}@holden.health`,
    `DTSTAMP:${calendarTimestamp(new Date())}`,
    `DTSTART:${calendarTimestamp(start)}`,
    `DTEND:${calendarTimestamp(end)}`,
    `SUMMARY:${calendarText("Free Zoom consultation with Kelsey")}`,
    `DESCRIPTION:${calendarText(`Holden Health Zoom consultation with ${fullName}. Join: ${zoomJoinUrl}`)}`,
    `LOCATION:${calendarText(zoomJoinUrl)}`,
    `URL:${zoomJoinUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return { filename: "holden-health-zoom-consultation.ics", content: Buffer.from(content).toString("base64") };
}

export function leadConversationCalendarInvite(id: string, startsAt: string, durationMinutes: number, meetingType: "phone" | "in_person", details: string) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const format = meetingType === "phone" ? "Phone call" : "In-person conversation";
  const content = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Holden Health//Lead Conversation//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${id}@holden.health`, `DTSTAMP:${calendarTimestamp(new Date())}`,
    `DTSTART:${calendarTimestamp(start)}`, `DTEND:${calendarTimestamp(end)}`,
    `SUMMARY:${calendarText(`Conversation with Kelsey at Holden Health`)}`,
    `DESCRIPTION:${calendarText(`${format}. ${details}`)}`,
    `LOCATION:${calendarText(meetingType === "phone" ? "Phone" : details)}`,
    "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return { filename: "holden-health-conversation.ics", content: Buffer.from(content).toString("base64") };
}
