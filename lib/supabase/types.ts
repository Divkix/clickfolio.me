export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          handle: string
          email: string
          avatar_url: string | null
          headline: string | null
          privacy_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          handle: string
          email: string
          avatar_url?: string | null
          headline?: string | null
          privacy_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          handle?: string
          email?: string
          avatar_url?: string | null
          headline?: string | null
          privacy_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          r2_key: string
          status: string
          replicate_job_id: string | null
          parsed_at: string | null
          retry_count: number
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          r2_key: string
          status?: string
          replicate_job_id?: string | null
          parsed_at?: string | null
          retry_count?: number
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          r2_key?: string
          status?: string
          replicate_job_id?: string | null
          parsed_at?: string | null
          retry_count?: number
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      site_data: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          content: Json
          theme_id: string
          last_published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          content: Json
          theme_id?: string
          last_published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          content?: Json
          theme_id?: string
          last_published_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_data_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          }
        ]
      }
      redirects: {
        Row: {
          id: string
          old_handle: string
          new_handle: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          old_handle: string
          new_handle: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          old_handle?: string
          new_handle?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
