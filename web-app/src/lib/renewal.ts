export type RenewalRecord = { session_id: string; status: string };
export function chooseRenewalSession<T extends { id: string }>(sessions: T[], enrollments: RenewalRecord[], requested?: string) {
  return sessions.find(s => s.id === requested)
    ?? sessions.find(s => !enrollments.some(e => e.session_id === s.id && ['invited', 'active', 'completed'].includes(e.status)))
    ?? sessions[0];
}
export function renewalStatus(enrolled: boolean, order?: { status: string } | null, request?: { status: string } | null) {
  if (order?.status === 'paid') return 'registered';
  if (order?.status === 'payment_processing') return 'processing';
  if (enrolled) return 'registered';
  if (order?.status === 'reserved') return 'checkout';
  if (request && ['pending', 'approved'].includes(request.status)) return 'offline';
  return 'available';
}
