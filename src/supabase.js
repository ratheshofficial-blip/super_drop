import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export let supabase = null
export let supabaseConfigError = ''

if (supabaseUrl || supabaseAnonKey) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.')
    }

    const url = new URL(supabaseUrl)
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error('VITE_SUPABASE_URL must use HTTP or HTTPS.')
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    supabaseConfigError = `Could not initialize Supabase: ${error.message}`
    console.error(supabaseConfigError, error)
  }
}
