"use client";
import { useFormStatus } from "react-dom";
export default function SendReviewButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="button primary" disabled={pending}>{pending ? "Sending requests…" : "Send review request"}</button>;
}
