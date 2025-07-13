import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          file_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          file_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          file_type?: string
          created_at?: string
          updated_at?: string
        }
      }
      logs: {
        Row: {
          id: string
          user_email: string
          file_name: string
          file_type: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_email: string
          file_name: string
          file_type: string
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          user_email?: string
          file_name?: string
          file_type?: string
          status?: string
          created_at?: string
        }
      }
    }
  }
}
