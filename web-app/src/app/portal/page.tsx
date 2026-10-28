import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export default async function PortalPage() {
  redirect(
    (await cookies()).has("holden_admin_enrollment_preview")
      ? "/portal/session"
      : "/portal/today",
  );
}
