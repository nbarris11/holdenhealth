export type IntakeResult = { error?: string; field?: string; redirect?: string };

/** Shared conditional requirements; ordinary required fields also use native validation. */
export function intakeConditionalError(form: FormData): IntakeResult | null {
  for (const [field, label] of [["goals", "your goals"], ["nutritionSupport", "nutrition support (or Nothing right now)"], ["coachingSupport", "coaching support"], ["commitments", "your commitments"]]) {
    if (!form.getAll(field).some(value => String(value).trim())) return { field, error: `Choose at least one option for ${label}.` };
  }
  for (const [source, value, field, label] of [
    ["goals", "Other", "goalOther", "your other goal"],
    ["nutritionSupport", "Other", "nutritionOther", "your other nutrition support request"],
    ["injury", "yes", "injuryDetail", "the injury, pain, or limitation you mentioned"],
    ["medications", "yes", "medicationDetail", "the medication information Kelsey needs"],
    ["precautions", "yes", "precautionDetail", "the exercise precautions you mentioned"],
  ]) {
    if (form.getAll(source).includes(value) && !String(form.get(field) ?? "").trim()) return { field, error: `Please explain ${label}.` };
  }
  if (["Text", "Phone"].includes(String(form.get("preferredCommunication"))) && String(form.get("contactPhone") ?? "").replace(/\D/g, "").length < 10) {
    return { field: "contactPhone", error: "Enter a phone number so Kelsey can contact you by text or phone." };
  }
  return null;
}
