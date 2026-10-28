import { createAdminClient } from '@/lib/supabase/admin';
import { CLASS_TIMES, privateSignupUrl } from '@/lib/private-signup';
import { createPrivateSignup, emailPrivateSignup, extendPrivateSignup } from './private-signup-actions';
import PrivateSubmit from '@/app/register/private/submit';

export default async function PrivateSignups({sessionId,message}:{sessionId:string;message?:string}) {
  const now = new Date().getTime();
  const admin=createAdminClient();
  const {data:offers,error}=await admin.from('private_signup_offers').select('id,full_name,email,attendance_time,amount_cents,email_sent_at,expires_at,checkout_order_id').eq('session_id',sessionId).order('created_at',{ascending:false});
  const ids=(offers??[]).flatMap(o=>o.checkout_order_id?[o.checkout_order_id]:[]);
  const {data:orders}=ids.length?await admin.from('checkout_orders').select('id,status').in('id',ids):{data:[]};
  const statuses=new Map((orders??[]).map(o=>[o.id,o.status]));
  const messages:Record<string,string>={extended:'The existing link is valid for another 14 days. You can email it again below.',created:'Private signup created. Review it below, then email the link or copy it to send yourself.',sent:'Payment link emailed.', 'email-failed':'The signup is saved, but the email could not be sent. Retry or copy the link below.',exists:'There is already a private signup for this email in this program. Use the existing link below.'};
  return <section id="private-signups" className="workspace-section">
    <div className="section-heading"><div><span className="eyebrow">By arrangement</span><h2>Private once-a-week signups</h2></div><p>Only you can create these. They are not listed in public signup or member plan choices.</p></div>
    {message && <p className="notice" role="status">{messages[message]??message}</p>}
    <details className="panel"><summary>Create a private signup and payment link</summary><p>Choose their agreed class time and total price for this program. The member confirms the safety and payment policies before paying. A $4 fee is added at online checkout. Creating the link does not reserve a place or send an email.</p>
      <form className="stack-form" action={createPrivateSignup}><input type="hidden" name="sessionId" value={sessionId}/>
        <div className="field-grid"><label>Full name<input name="fullName" minLength={2} maxLength={140} required/></label><label>Email<input name="email" type="email" maxLength={254} required/></label></div>
        <div className="field-grid"><label>One class each week<select name="attendanceTime" defaultValue="" required><option value="">Choose their class time</option>{CLASS_TIMES.map(t=><option key={t}>{t}</option>)}</select></label><label>Price for the whole session ($)<input name="amount" type="number" min="1" max="10000" step="0.01" required/></label></div>
        <PrivateSubmit label="Create private payment link"/>
      </form>
    </details>
    {error && <p className="notice error">Private signups could not be loaded.</p>}
    <div className="approval-grid">{(offers??[]).map(o=>{const status=statuses.get(o.checkout_order_id);const paid=status==='paid';const processing=status==='payment_processing';const expired=Date.parse(o.expires_at)<=now;return <article className="panel approval-card" key={o.id}><h3>{o.full_name}</h3><p>{o.email}</p><p>1 class/week · {o.attendance_time}<br/>${(o.amount_cents/100).toFixed(2)} for the session + $4 online fee</p><p><strong>{paid?'Paid · class signup confirmed':processing?'Payment processing':expired?'Link expired':status==='reserved'?'Checkout started':o.email_sent_at?'Payment link emailed':'Ready to send'}</strong></p>{paid && <p><a className="text-link" href={`/admin/classes?program=${sessionId}`}>View class roster →</a></p>}{!paid&&!processing&&!expired && <><label className="stack-form">Private payment link<input readOnly value={privateSignupUrl(o.id)} aria-label={`Payment link for ${o.full_name}`}/></label><div className="button-row"><a className="button secondary" href={privateSignupUrl(o.id)} target="_blank" rel="noreferrer">Review signup</a><form action={emailPrivateSignup}><input type="hidden" name="offerId" value={o.id}/><PrivateSubmit label={o.email_sent_at?'Resend payment email':'Email payment link'}/></form></div></>}{expired&&!paid&&!processing && <form action={extendPrivateSignup}><input type="hidden" name="offerId" value={o.id}/><PrivateSubmit label="Extend link for 14 days"/></form>}</article>;})}</div>
  </section>;
}
