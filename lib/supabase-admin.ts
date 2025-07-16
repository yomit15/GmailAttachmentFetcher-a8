import { createClient } from "@supabase/supabase-js"

// Create a service role client for server-side operations
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
