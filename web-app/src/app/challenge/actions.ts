"use server";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { captureServerEvent } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import {
  detroitToday,
  eligibleDay,
  isUuid,
  type FormResult,
} from "@/lib/challenge";

export async function requestChallengeLink(
  _: FormResult,
  data: FormData,
): Promise<FormResult> {
  const email = String(data.get("email") || "").trim();
  const id = String(data.get("challenge_id") || "");
  if (
    !isUuid(id) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  )
    return { error: "Enter a valid email address." };
  if (String(data.get("website") || "")) return { error: "Please try again." };
  const db = await createClient();
  const { data: challenge, error: lookupError } = await db
    .from("habit_challenges")
    .select("id,published,signup_open,ends_on")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !challenge?.published)
    return { error: "This challenge is not available yet." };
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "Please reload the page and try again." };
  // Existing participants can always sign back in, even after signup closes.
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser:
        challenge.signup_open && challenge.ends_on >= detroitToday(),
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`/challenge?id=${id}`)}`,
    },
  });
  if (error)
    return {
      error:
        error.status === 429
          ? "Please wait a minute before requesting another sign-in email."
          : "We could not send the link. Try again, or contact Kelsey if signup has closed.",
    };
  (await cookies()).set("holden_challenge_return", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 3600 });
  return {
    success:
      "Check your email for a secure sign-in link. Open it to choose your goals or return to your challenge.",
  };
}

export async function joinChallenge(
  _: FormResult,
  data: FormData,
): Promise<FormResult> {
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub)
    return {
      error: "Your sign-in expired. Reload this page and sign in again.",
    };
  const id = String(data.get("challenge_id") || "");
  const displayName = String(data.get("display_name") || "").trim();
  const goals = data
    .getAll("goal")
    .map(String)
    .concat(data.getAll("custom_goal").map(String))
    .map((g) => g.trim())
    .filter(Boolean);
  const weekly = Number(data.get("weekly_workouts"));
  if (
    !isUuid(id) ||
    !displayName ||
    displayName.length > 100 ||
    goals.length !== 3 ||
    new Set(goals.map((g) => g.toLowerCase())).size !== 3 ||
    goals.some((g) => g.length > 140) ||
    !Number.isInteger(weekly) ||
    weekly < 1 ||
    weekly > 7
  )
    return {
      error:
        "Enter your name, three different habits, and a weekly workout commitment.",
    };
  const { error } = await db
    .from("challenge_participants")
    .insert({
      challenge_id: id,
      user_id: auth.claims.sub,
      display_name: displayName,
      goals,
      weekly_workouts: weekly,
    });
  if (error && error.code !== "23505")
    return {
      error:
        "We could not join this challenge. Signup may have closed. Your choices have not been saved.",
    };
  if (!error) {
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", auth.claims.sub).maybeSingle();
    if (profile && !profile.full_name?.trim()) {
      await db.from("profiles").update({ full_name: displayName }).eq("id", auth.claims.sub).eq("full_name", profile.full_name);
    }
  }
  if (!error) {
    await captureServerEvent(auth.claims.sub, "challenge_joined", {
      goal_count: goals.length,
      weekly_workout_commitment: weekly,
    });
  }
  revalidatePath("/challenge");
  revalidatePath("/admin/people", "layout");
  revalidatePath("/admin/challenges");
  redirect(`/challenge?id=${id}`);
}

export async function saveCheckmark(input: {
  participantId: string;
  day: string;
  goalIndex: number;
  completed: boolean;
}): Promise<FormResult> {
  if (
    !isUuid(input.participantId) ||
    !Number.isInteger(input.goalIndex) ||
    input.goalIndex < 0 ||
    input.goalIndex > 2 ||
    typeof input.completed !== "boolean"
  )
    return { error: "Invalid progress update." };
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub)
    return { error: "Please sign in again before saving." };
  const { data: participant } = await db
    .from("challenge_participants")
    .select("challenge_id,joined_on")
    .eq("id", input.participantId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!participant)
    return { error: "Your challenge enrollment could not be found." };
  const { data: challenge } = await db
    .from("habit_challenges")
    .select("starts_on,ends_on")
    .eq("id", participant.challenge_id)
    .maybeSingle();
  if (
    !challenge ||
    !eligibleDay(challenge, participant.joined_on, input.day, detroitToday())
  )
    return {
      error:
        "Choose a day during the challenge, on or after you joined, and no later than today.",
    };
  const { error } = await db
    .from("challenge_checkmarks")
    .upsert(
      {
        participant_id: input.participantId,
        day: input.day,
        goal_index: input.goalIndex,
        completed: input.completed,
      },
      { onConflict: "participant_id,day,goal_index" },
    );
  if (error) return { error: "That checkmark did not save. Please try again." };
  await captureServerEvent(auth.claims.sub, "challenge_progress_updated", {
    completed: input.completed,
    goal_index: input.goalIndex,
  });
  revalidatePath("/challenge");
  revalidatePath("/admin/challenges");
  revalidatePath("/portal", "layout");
  return { success: "Progress saved." };
}
