// Emails that have admin access to /admin/reports.
// Must match the auth email the user signs in with.
// Keep this list in sync with the Supabase RLS policies (see README / migration SQL).
export const ADMIN_EMAILS: string[] = [
  'dewetgeorgene@gmail.com', // TODO: replace with your real admin email(s)
]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
