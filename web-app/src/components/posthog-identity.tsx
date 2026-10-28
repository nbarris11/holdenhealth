"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncPostHogIdentity } from "@/lib/posthog-identity";

export default function PostHogIdentity() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    const supabase = createClient();
    let revision = 0;
    let disposed = false;
    const refresh = async () => {
      const run = ++revision;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (disposed || run !== revision) return;
        if (error || !data.user) { syncPostHogIdentity(null); return; }
        const id = data.user.id;
        // Clear a previous account before waiting for this account's profile.
        syncPostHogIdentity({ id });
        const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
        if (disposed || run !== revision || profileError) return;
        let name = profile?.full_name?.trim();
        if (!name) {
          const { data: participant } = await supabase.from("challenge_participants")
            .select("display_name").eq("user_id", id).order("joined_on", { ascending: false }).limit(1).maybeSingle();
          if (disposed || run !== revision) return;
          name = participant?.display_name?.trim();
        }
        syncPostHogIdentity({ id, name });
      } catch {
        // Analytics must not affect sign-in or member navigation.
      }
    };
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { ++revision; syncPostHogIdentity(null); }
      // Defer calls until outside Supabase's auth callback lock.
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => { if (!disposed) void refresh(); }, 0);
    });
    window.addEventListener("focus", refresh);
    // Signup/profile approval can finish without a pathname change.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => { disposed = true; ++revision; subscription.unsubscribe(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [pathname]);
  return null;
}
