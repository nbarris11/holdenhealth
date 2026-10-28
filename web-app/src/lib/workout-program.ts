import { isUuid } from "./challenge";

export type WorkoutProgram = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
};

export function workoutScope(challengeId: string, sessionId: string, relationshipId = "") {
  if ([challengeId, sessionId, relationshipId].filter(Boolean).length !== 1) return null;
  const id = relationshipId || sessionId || challengeId;
  if (!isUuid(id)) return null;
  return relationshipId ? { id, column: "relationship_id" as const, table: "coaching_relationships" as const } : sessionId
    ? { id, column: "session_id" as const, table: "sessions" as const }
    : { id, column: "challenge_id" as const, table: "habit_challenges" as const };
}

export function workoutLibraryPath(workout: { challenge_id: string | null; session_id?: string | null; relationship_id?: string | null }) {
  return workout.relationship_id ? "/portal/training" : workout.session_id
    ? `/portal/workouts?program=${workout.session_id}`
    : `/portal/workouts?challenge=${workout.challenge_id}`;
}
