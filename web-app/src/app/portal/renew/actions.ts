'use server';
import { redirect } from 'next/navigation';
import { renewalData } from '@/lib/renewal-data';
import { submitEnrollment } from '@/app/register/enrollment-action';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

export async function submitRenewal(formData: FormData) {
  const id = String(formData.get('sessionId') ?? '');
  const d = await renewalData(id);
  if (!d.session || d.session.id !== id || d.status !== 'available') redirect(`/portal/renew?session=${encodeURIComponent(id)}`);
  // Keep the new membership attached to the authenticated account, even if the form is tampered with.
  formData.set('email', d.auth.email);
  formData.set('renewal', 'on');
  return submitEnrollment(formData);
}

export async function resumeRenewal(formData: FormData) {
  const id = String(formData.get('sessionId') ?? '');
  const d = await renewalData(id);
  const back = `/portal/renew?session=${encodeURIComponent(id)}`;
  if (!d.session || d.session.id !== id || d.status !== 'checkout' || !d.order?.stripe_checkout_session_id) redirect(back);
  let destination: string | null = null;
  try {
    const checkout = await getStripe().checkout.sessions.retrieve(d.order.stripe_checkout_session_id);
    if (checkout.status === 'open' && checkout.url) destination = checkout.url;
    else if (checkout.status === 'expired') {
      const {error} = await createAdminClient().from('checkout_orders').update({status:'expired'})
        .eq('id', d.order.id).eq('email',d.auth.email.toLowerCase()).eq('status','reserved');
      if (error) throw error;
      destination = back;
    }
  } catch { redirect(`${back}&message=unavailable`); }
  redirect(destination ?? `${back}&message=confirming`);
}
