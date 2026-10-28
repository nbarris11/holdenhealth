import Link from "next/link";
import { verifyAdmin } from "@/lib/auth";
import NewProgramForm from "../new-program-form";

export default async function NewClassProgramPage() {
  await verifyAdmin();
  return <main className="app-shell admin-shell workspace-page settings-page">
    <header className="workspace-page-header"><div><Link className="back-link" href="/admin/training">← Programs</Link><span className="eyebrow">Group fitness</span><h1>Create a class program</h1><p>Set up the dates, prices, and recurring class schedule. Nothing appears to customers until you open it.</p></div></header>
    <div className="settings-grid"><NewProgramForm /><aside className="panel"><h2>Before you share it</h2><p>After creating the draft, open Program details and Schedule to review everything. Then choose “Accepting registrations” and “Show this program to customers.”</p><p>Once registration is open, Program details shows the direct signup link. You can feature it on the public website from Content → Edit your website.</p></aside></div>
  </main>;
}
