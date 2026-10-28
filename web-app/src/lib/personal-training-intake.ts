export type IntakeField = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "date" | "tel" | "email" | "number" | "radio" | "checkbox" | "yesno";
  options?: readonly string[];
  required?: boolean;
  detailName?: string;
  detailLabel?: string;
  otherName?: string;
};

export const personalTrainingIntakeSections: readonly {
  id: string;
  title: string;
  intro?: string;
  fields: readonly IntakeField[];
}[] = [
  { id: "basicInformation", title: "1. BASIC INFORMATION", fields: [
    { name: "name", label: "Name:", kind: "text", required: true },
    { name: "dateOfBirth", label: "Date of Birth:", kind: "date", required: true },
    { name: "phone", label: "Phone:", kind: "tel", required: true },
    { name: "email", label: "Email:", kind: "email", required: true },
    { name: "emergencyContact", label: "Emergency Contact:", kind: "text", required: true },
    { name: "emergencyContactPhone", label: "Emergency Contact Phone:", kind: "tel", required: true },
    { name: "preferredCommunication", label: "Preferred method of communication:", kind: "radio", options: ["Text", "Email", "Phone"], required: true },
  ] },
  { id: "yourGoals", title: "2. YOUR GOALS", fields: [
    { name: "primaryGoals", label: "What are your primary goals?", kind: "checkbox", options: ["Build strength", "Improve cardiovascular fitness", "Improve mobility/flexibility", "Lose body fat", "Build muscle", "Improve energy", "Improve confidence", "Improve daily function", "Prepare for an event/sport", "Establish a consistent exercise routine", "Other"], otherName: "primaryGoalsOther" },
    { name: "trainingAccomplishment", label: "What would you most like to accomplish through personal training?", kind: "textarea" },
    { name: "goalImportance", label: "Why is this goal important to you?", kind: "textarea" },
    { name: "successThreeToSixMonths", label: "What would success look like to you 3–6 months from now?", kind: "textarea" },
  ] },
  { id: "currentRoutine", title: "3. YOUR CURRENT ROUTINE", fields: [
    { name: "activityLevel", label: "How active are you currently?", kind: "radio", options: ["Mostly sedentary", "Lightly active", "Moderately active", "Very active"] },
    { name: "currentExercise", label: "What types of exercise are you currently doing?", kind: "textarea" },
    { name: "exerciseDaysPerWeek", label: "How many days per week do you currently exercise?", kind: "number" },
    { name: "exerciseEnjoy", label: "What types of exercise do you enjoy?", kind: "textarea" },
    { name: "exerciseNotEnjoy", label: "What types of exercise do you NOT enjoy?", kind: "textarea" },
  ] },
  { id: "exerciseHistory", title: "4. EXERCISE HISTORY", fields: [
    { name: "priorTrainer", label: "Have you worked with a personal trainer before?", kind: "yesno", detailName: "priorTrainerExperience", detailLabel: "If yes, what did you like or dislike about the experience?" },
    { name: "movementsEnjoy", label: "Are there any exercises or movements you particularly enjoy?", kind: "textarea" },
    { name: "movementsDislike", label: "Are there any exercises or movements you strongly dislike?", kind: "textarea" },
    { name: "consistencyBarriers", label: "What has made it difficult to stay consistent with exercise in the past?", kind: "textarea" },
  ] },
  { id: "healthInjuryHistory", title: "5. HEALTH & INJURY HISTORY", fields: [
    { name: "medicalCondition", label: "Has a healthcare professional ever told you that you have a medical condition that may affect your ability to exercise?", kind: "yesno", required: true, detailName: "medicalConditionDetail", detailLabel: "If yes, please explain:" },
    { name: "currentInjury", label: "Do you currently have any injuries, pain, or physical limitations?", kind: "yesno", required: true, detailName: "currentInjuryDetail", detailLabel: "If yes, please explain:" },
    { name: "priorSurgery", label: "Have you had any previous surgeries or significant injuries that may affect your training?", kind: "yesno", required: true, detailName: "priorSurgeryDetail", detailLabel: "If yes, please explain:" },
    { name: "medication", label: "Are you currently taking any medications that may affect exercise, heart rate, blood pressure, balance, or energy levels?", kind: "yesno", required: true, detailName: "medicationDetail", detailLabel: "If yes, please list them or note anything I should be aware of:" },
    { name: "otherHealth", label: "Is there anything else about your health or physical abilities that you think I should know?", kind: "textarea" },
  ] },
  { id: "movementConsiderations", title: "6. MOVEMENT & TRAINING CONSIDERATIONS", fields: [
    { name: "difficultMovements", label: "Are there any movements you currently have difficulty performing?", kind: "textarea" },
    { name: "bodyAreas", label: "Are there any areas of your body you'd like to strengthen or improve?", kind: "textarea" },
    { name: "homeEquipment", label: "Do you have any equipment available at home?", kind: "textarea" },
    { name: "outsideSessionTime", label: "How much time can you realistically dedicate to exercise outside of our sessions?", kind: "radio", options: ["10–15 minutes", "20–30 minutes", "30–45 minutes", "45+ minutes"] },
  ] },
  { id: "lifestyleAccountability", title: "7. LIFESTYLE & ACCOUNTABILITY", fields: [
    { name: "typicalWeek", label: "What does a typical week look like for you?", kind: "textarea" },
    { name: "selfCareBarriers", label: "What tends to get in the way of taking care of yourself?", kind: "textarea" },
    { name: "accountability", label: "What type of accountability works best for you?", kind: "checkbox", options: ["Regular check-ins", "Text reminders", "Having a specific workout plan", "Tracking progress", "Encouragement", "Someone holding me accountable", "Other"], otherName: "accountabilityOther" },
    { name: "coachingStyle", label: "How would you like me to coach you?", kind: "checkbox", options: ["Encouraging/supportive", "Direct/accountable", "A combination of both", "Other"], otherName: "coachingStyleOther" },
  ] },
  { id: "betweenSessionWorkouts", title: "8. BETWEEN-SESSION WORKOUTS", intro: "Since personal training sessions are $100 per session, I'll provide workouts and guidance for you to follow between our sessions.", fields: [
    { name: "additionalExerciseDays", label: "How many additional days per week would you realistically like to exercise?", kind: "radio", options: ["0", "1", "2", "3+"] },
    { name: "workoutLocation", label: "Where will you primarily complete these workouts?", kind: "radio", options: ["Home", "Gym", "Outdoors", "Combination"] },
    { name: "workoutEquipment", label: "What equipment do you have access to?", kind: "textarea" },
  ] },
  { id: "nutritionHabits", title: "9. NUTRITION & HABITS", fields: [
    { name: "nutritionHabits", label: "Are there any nutrition or lifestyle habits you'd like to work on?", kind: "textarea" },
    { name: "nutritionSupport", label: "Which area would you most like support with?", kind: "checkbox", options: ["Protein", "Fruits & vegetables", "Water", "Meal planning", "Mindful eating", "Consistency", "Eating around workouts", "Other"], otherName: "nutritionSupportOther" },
  ] },
  { id: "finalQuestions", title: "10. FINAL QUESTIONS", fields: [
    { name: "needsFromCoach", label: "What do you need from me to feel successful?", kind: "textarea" },
    { name: "hopedFor", label: "Is there anything you were hoping to get out of personal training that we haven't discussed?", kind: "textarea" },
    { name: "beginningFeelings", label: "Is there anything you're nervous, unsure, or excited about as you begin?", kind: "textarea" },
  ] },
];

export const acknowledgmentText = [
  "I understand that personal training involves physical activity and that I am responsible for communicating any changes in my health, injuries, pain, or other conditions that may affect my ability to exercise.",
  "I understand that Holden Health provides fitness coaching and is not a substitute for medical care. I will seek appropriate medical guidance when necessary.",
] as const;

export const acknowledgmentFields: readonly IntakeField[] = [
  { name: "clientName", label: "Client Name:", kind: "text", required: true },
  { name: "signature", label: "Signature:", kind: "text", required: true },
  { name: "signatureDate", label: "Date:", kind: "date", required: true },
];

export function intakeFieldLabel(name: string) {
  for (const section of personalTrainingIntakeSections) {
    for (const field of section.fields) {
      if (field.name === name) return field.label;
      if (field.detailName === name) return field.detailLabel || name;
      if (field.otherName === name) return "Other:";
    }
  }
  return acknowledgmentFields.find(field => field.name === name)?.label || name;
}

export type ParsedTrainingIntake = {
  responses: Record<string, Record<string, string | string[]>>;
  signedName: string;
  healthReviewRequired: boolean;
  error?: { field: string; message: string };
};

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim().slice(0, 2000);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePersonalTrainingIntake(form: FormData): ParsedTrainingIntake {
  const responses: ParsedTrainingIntake["responses"] = {};
  for (const section of personalTrainingIntakeSections) {
    const answers: Record<string, string | string[]> = {};
    for (const field of section.fields) {
      if (field.kind === "checkbox") {
        const selected = form.getAll(field.name).map(String);
        if (selected.some(option => !field.options?.includes(option)) || new Set(selected).size !== selected.length) {
          return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Choose a valid answer for ${field.label}` } };
        }
        answers[field.name] = selected;
      } else {
        const answer = formText(form, field.name);
        if (field.required && !answer) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Please answer ${field.label}` } };
        if (field.options && answer && !field.options.includes(answer)) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Choose a valid answer for ${field.label}` } };
        if (field.kind === "yesno" && answer && !["Yes", "No"].includes(answer)) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Choose Yes or No for ${field.label}` } };
        if (field.kind === "date" && answer && (!validDate(answer) || answer > new Date().toISOString().slice(0, 10))) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Enter a valid date for ${field.label}` } };
        if (field.kind === "email" && answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: "Enter a valid email address." } };
        if (field.kind === "number" && answer && (!Number.isInteger(Number(answer)) || Number(answer) < 0 || Number(answer) > 7)) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: "Enter a number from 0 to 7." } };
        answers[field.name] = answer;
      }
      if (field.detailName) {
        const detail = formText(form, field.detailName);
        if (answers[field.name] === "Yes" && !detail) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.detailName, message: `Please answer ${field.detailLabel}` } };
        answers[field.detailName] = detail;
      }
      if (field.otherName) {
        const other = formText(form, field.otherName);
        if ((answers[field.name] as string[]).includes("Other") && !other) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.otherName, message: "Please describe Other." } };
        answers[field.otherName] = other;
      }
    }
    responses[section.id] = answers;
  }
  const acknowledgment: Record<string, string> = {};
  for (const field of acknowledgmentFields) {
    const answer = formText(form, field.name);
    if (!answer) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: `Please complete ${field.label}` } };
    if (field.kind === "date" && (!validDate(answer) || answer > new Date().toISOString().slice(0, 10))) return { responses, signedName: "", healthReviewRequired: false, error: { field: field.name, message: "Enter a valid signature date." } };
    acknowledgment[field.name] = answer;
  }
  if (acknowledgment.signature.length < 2 || acknowledgment.clientName.length < 2) return { responses, signedName: "", healthReviewRequired: false, error: { field: "signature", message: "Enter your name and signature." } };
  responses.clientAcknowledgment = acknowledgment;
  return {
    responses,
    signedName: acknowledgment.signature.slice(0, 140),
    healthReviewRequired: ["medicalCondition", "currentInjury", "priorSurgery", "medication"].some(field => responses.healthInjuryHistory[field] === "Yes"),
  };
}
