import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vbiqdupvbjqfelfuwkoc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaXFkdXB2YmpxZmVsZnV3a29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDM4NzgsImV4cCI6MjA4NzcxOTg3OH0.UT_bgnVZuU83QVWGtfgqOt6S9Zp46HhkK8-AVuE2GVg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
