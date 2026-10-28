export type RiskContext = "personal_training" | "group_class";

const personalBeforeEmergency = `Holden Health, LLC (“Holden Health”) provides individualized personal training and fitness coaching designed to help clients improve strength, fitness, movement, and healthy habits.
Personal training includes:
- One-hour, in-person training sessions
- Individualized exercise instruction
- Coaching on form, technique, and intensity
- Personalized workouts to complete between sessions
- Exercise modifications as needed
- Progressions based on client performance and goals
- Reasonable communication and support between sessions
Personal training is fitness coaching and is not medical care, physical therapy, or treatment for a medical condition or injury.

Personal training is $100 per one-hour session.
Sessions may be scheduled on an individual basis or as recurring sessions.

Payment is due prior to or at the time of each session unless another arrangement has been agreed upon in writing.
Please provide at least 24 hours' notice when canceling or rescheduling a session.
Sessions canceled with less than 24 hours' notice or missed without notice may be charged as a completed session.
Holden Health understands that emergencies and unexpected circumstances happen. Exceptions may be made at Holden Health's discretion.

The client agrees to:
- Provide accurate and complete health and fitness information.
- Inform Holden Health of any changes in health, medications, injuries, pain, or physical limitations.
- Follow instructions provided during training.
- Ask questions when an exercise or instruction is unclear.
- Stop exercising and notify the coach if they experience unusual pain, dizziness, chest pain, shortness of breath, or other concerning symptoms.
- Obtain appropriate medical clearance when recommended or necessary.

I understand that physical exercise and fitness training involve inherent risks. These risks may include, but are not limited to, muscle soreness, strains, sprains, falls, injury, aggravation of an existing condition, cardiovascular events, and, in rare circumstances, serious injury or death.
I voluntarily choose to participate in personal training and understand that the level and type of exercise will be based on information I provide and my participation and performance during training.
I understand that no exercise program can guarantee specific results.

In consideration of being permitted to participate in personal training with Holden Health, LLC, I voluntarily assume the risks associated with participation.
To the fullest extent permitted by applicable law, I release and agree to hold harmless Holden Health, LLC, its owner, coaches, contractors, employees, agents, and representatives from claims, demands, damages, or causes of action arising from my participation in personal training or use of exercise equipment and facilities, including claims arising from ordinary negligence.
This release does not apply to conduct that cannot legally be released or waived under applicable law.
I understand that I am responsible for determining whether I am physically capable of participating in exercise and for communicating relevant health information to Holden Health.

I understand that Holden Health is not a medical provider and does not diagnose or treat medical conditions.
If an emergency occurs during a training session, I authorize Holden Health and/or emergency personnel to take reasonable steps to obtain emergency medical assistance on my behalf.
I understand that I am responsible for any medical expenses resulting from an injury, illness, or emergency.`;

const personalAfterEmergency = `Personal training sessions may take place at Moore Performance Health, 41100 Plymouth Rd., Suite B1-162, Plymouth, MI 48170, or another location mutually agreed upon by Holden Health and the client.
I agree to use equipment responsibly and follow facility rules and instructions.
I understand that Holden Health does not own or control the entire facility and that the facility may have its own rules, policies, and liability terms.

I understand that individual results vary and may be affected by factors including consistency, nutrition, sleep, stress, genetics, medical history, lifestyle, and adherence to the program.
Holden Health does not guarantee a particular amount of weight loss, muscle gain, strength improvement, or other specific outcome.

I authorize Holden Health to communicate with me regarding scheduling, workouts, progress, accountability, and other matters related to my personal training program through the contact information I provide.`;

const personalAfterCommunication = `This agreement represents the understanding between Holden Health, LLC and the client regarding personal training services.
If any provision of this agreement is determined to be invalid or unenforceable, the remaining provisions shall remain in effect to the fullest extent permitted by law.
I understand that I have had the opportunity to read this agreement, ask questions, and seek independent legal advice before signing.`;

const groupBeforeEmergency = `Holden Health, LLC (“Holden Health”) provides group fitness classes and coaching designed to help participants improve strength, fitness, movement, and healthy habits.
Group classes include coached exercise instruction, guidance on form and intensity, and modifications when appropriate. Group fitness coaching is not medical care, physical therapy, or treatment for a medical condition or injury.

The class dates, price, payment, cancellation, and attendance policies are those shown for the program at signup.

The participant agrees to:
- Provide accurate and complete health and fitness information.
- Inform Holden Health of any changes in health, medications, injuries, pain, or physical limitations.
- Follow instructions provided during class.
- Ask questions when an exercise or instruction is unclear.
- Stop exercising and notify the coach if they experience unusual pain, dizziness, chest pain, shortness of breath, or other concerning symptoms.
- Obtain appropriate medical clearance when recommended or necessary.

I understand that physical exercise and fitness classes involve inherent risks. These risks may include, but are not limited to, muscle soreness, strains, sprains, falls, injury, aggravation of an existing condition, cardiovascular events, and, in rare circumstances, serious injury or death.
I voluntarily choose to participate in group fitness classes and understand that exercises and modifications will be based on information I provide and my participation during class.
I understand that no exercise program can guarantee specific results.

In consideration of being permitted to participate in group fitness classes with Holden Health, LLC, I voluntarily assume the risks associated with participation.
To the fullest extent permitted by applicable law, I release and agree to hold harmless Holden Health, LLC, its owner, coaches, contractors, employees, agents, and representatives from claims, demands, damages, or causes of action arising from my participation in group classes or use of exercise equipment and facilities, including claims arising from ordinary negligence.
This release does not apply to conduct that cannot legally be released or waived under applicable law.
I understand that I am responsible for determining whether I am physically capable of participating in exercise and for communicating relevant health information to Holden Health.

I understand that Holden Health is not a medical provider and does not diagnose or treat medical conditions.
If an emergency occurs during a class, I authorize Holden Health and/or emergency personnel to take reasonable steps to obtain emergency medical assistance on my behalf.
I understand that I am responsible for any medical expenses resulting from an injury, illness, or emergency.`;

const groupAfterEmergency = `In-person classes may take place at the location listed for the class program or another location communicated by Holden Health. Some classes may take place online, as shown on the schedule.
I agree to use equipment responsibly and follow facility rules and instructions.
I understand that Holden Health does not own or control every facility used for classes and that a facility may have its own rules, policies, and liability terms.

I understand that individual results vary and may be affected by factors including consistency, nutrition, sleep, stress, genetics, medical history, lifestyle, and participation in the program.
Holden Health does not guarantee a particular amount of weight loss, muscle gain, strength improvement, or other specific outcome.

I authorize Holden Health to communicate with me regarding class scheduling, workouts, progress, accountability, and other matters related to my group program through the contact information I provide.`;

const groupAfterCommunication = `This agreement represents the understanding between Holden Health, LLC and the participant regarding group fitness classes.
If any provision of this agreement is determined to be invalid or unenforceable, the remaining provisions shall remain in effect to the fullest extent permitted by law.
I understand that I have had the opportunity to read this agreement, ask questions, and seek independent legal advice before signing.`;

const personalAcknowledgments = [
  "I have read and understand this agreement.",
  "I understand the risks associated with physical exercise and personal training.",
  "I have disclosed relevant health conditions, injuries, limitations, and other information that may affect my ability to exercise.",
  "I understand that Holden Health provides fitness coaching and is not a medical provider.",
  "I voluntarily agree to participate in personal training.",
  "I understand and agree to the payment and cancellation policies described above.",
] as const;

const groupAcknowledgments = [
  "I have read and understand this agreement.",
  "I understand the risks associated with physical exercise and group fitness classes.",
  "I have disclosed relevant health conditions, injuries, limitations, and other information that may affect my ability to exercise.",
  "I understand that Holden Health provides fitness coaching and is not a medical provider.",
  "I voluntarily agree to participate in group fitness classes.",
  "I understand and agree to the class payment, cancellation, and attendance policies shown at signup.",
] as const;

export function riskAgreement(context: RiskContext) {
  const personal = context === "personal_training";
  const beforeEmergency = personal ? personalBeforeEmergency : groupBeforeEmergency;
  const afterEmergency = personal ? personalAfterEmergency : groupAfterEmergency;
  const afterCommunication = personal ? personalAfterCommunication : groupAfterCommunication;
  const acknowledgments = personal ? personalAcknowledgments : groupAcknowledgments;
  const documentText = [
    "Client Name:\nPhone:\nEmail:", beforeEmergency,
    "Emergency Contact:\nEmergency Contact Phone:", afterEmergency,
    "Preferred communication:\n☐ Text\n☐ Email\n☐ Phone", afterCommunication,
    "By signing below, I acknowledge that:\n" + acknowledgments.map(item => `☐ ${item}`).join("\n"),
    "Client Printed Name:\nClient Signature:\nDate:\nHolden Health Representative:\nDate:",
  ].join("\n\n");
  return {
    version: personal ? "2026-09-28-personal-training-risk-v1" : "2026-09-28-group-class-risk-v1",
    beforeEmergency, afterEmergency, afterCommunication, acknowledgments, documentText,
  };
}

export type RiskAgreementResult = { error?: string; field?: string; values?: Record<string, string>; acknowledgments?: string[] };

export function validateRiskAgreement(form: FormData, context: RiskContext): RiskAgreementResult {
  const fields = ["clientName", "phone", "email", "emergencyContact", "emergencyContactPhone", "preferredCommunication", "printedName", "signature", "signedOn"];
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = String(form.get(field) ?? "").trim().slice(0, field === "email" ? 254 : 300);
    if (!value) return { field, error: `Please complete ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.` };
    values[field] = value;
  }
  if (!["Text", "Email", "Phone"].includes(values.preferredCommunication)) return { field: "preferredCommunication", error: "Choose a preferred communication method." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return { field: "email", error: "Enter a valid email address." };
  if (values.printedName.length < 2 || values.signature.length < 2 || values.clientName.length < 2) return { field: "signature", error: "Enter your printed name and signature." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.signedOn) || Number.isNaN(new Date(`${values.signedOn}T12:00:00Z`).getTime())) return { field: "signedOn", error: "Enter a valid signature date." };
  const selected = form.getAll("riskAcknowledgment").map(String);
  const required = riskAgreement(context).acknowledgments;
  if (selected.length !== required.length || required.some(item => !selected.includes(item))) return { field: "riskAcknowledgment", error: "Check each acknowledgment before signing." };
  return { values, acknowledgments: selected };
}
