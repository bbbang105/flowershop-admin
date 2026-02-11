'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { withErrorLogging } from '@/lib/errors'

async function _signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export const signOut = withErrorLogging('signOut', _signOut);
