import "server-only";

type ZoomTokenResponse = { access_token?: string };
type ZoomMeetingResponse = { id?: number | string; join_url?: string };

function requiredZoomEnv(name: "ZOOM_ACCOUNT_ID" | "ZOOM_CLIENT_ID" | "ZOOM_CLIENT_SECRET" | "ZOOM_HOST_USER") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Zoom is not configured for the portal.");
  return value;
}

async function zoomAccessToken() {
  const accountId = requiredZoomEnv("ZOOM_ACCOUNT_ID");
  const clientId = requiredZoomEnv("ZOOM_CLIENT_ID");
  const clientSecret = requiredZoomEnv("ZOOM_CLIENT_SECRET");
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as ZoomTokenResponse;
  if (!response.ok || !data.access_token) throw new Error("Zoom did not authorize the portal.");
  return data.access_token;
}

export async function createScheduledZoomMeeting(title: string, startsAt: string, durationMinutes: number) {
  const accessToken = await zoomAccessToken();
  const hostUser = requiredZoomEnv("ZOOM_HOST_USER");
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostUser)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: `Holden Health · ${title}`.slice(0, 200),
      type: 2,
      start_time: startsAt,
      duration: durationMinutes,
      timezone: "America/Detroit",
      agenda: "Private Holden Health class for registered attendees.",
      settings: {
        host_video: true,
        participant_video: false,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
      },
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as ZoomMeetingResponse;
  if (!response.ok || !data.id || !data.join_url) throw new Error("Zoom could not create the class meeting.");
  return { zoomMeetingId: String(data.id), joinUrl: data.join_url };
}
