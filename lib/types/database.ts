// Database types for Supabase
// Generated from schema, keep in sync with supabase-schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          handle: string | null
          avatar_url: string | null
          headline: string | null
          privacy_settings: {
            show_phone: boolean
            show_address: boolean
          }
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          handle?: string | null
          avatar_url?: string | null
          headline?: string | null
          privacy_settings?: {
            show_phone: boolean
            show_address: boolean
          }
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          handle?: string | null
          avatar_url?: string | null
          headline?: string | null
          privacy_settings?: {
            show_phone: boolean
            show_address: boolean
          }
          created_at?: string
          updated_at?: string
        }
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          r2_key: string
          status: 'pending_claim' | 'processing' | 'completed' | 'failed'
          error_message: string | null
          replicate_job_id: string | null
          parsed_at: string | null
          retry_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          r2_key: string
          status?: 'pending_claim' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          replicate_job_id?: string | null
          parsed_at?: string | null
          retry_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          r2_key?: string
          status?: 'pending_claim' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          replicate_job_id?: string | null
          parsed_at?: string | null
          retry_count?: number
          created_at?: string
        }
      }
      site_data: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          content: ResumeContent
          theme_id: string
          last_published_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          content: ResumeContent
          theme_id?: string
          last_published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          content?: ResumeContent
          theme_id?: string
          last_published_at?: string
          created_at?: string
          updated_at?: string
        }
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
      }
    }
  }
}

// Resume content structure (from AI parsing)
export interface ResumeContent {
  full_name: string
  headline: string
  summary: string
  contact: {
    email: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    website?: string
  }
  experience: Array<{
    title: string
    company: string
    location?: string
    start_date: string
    end_date?: string
    description: string
    highlights?: string[]
  }>
  education?: Array<{
    degree: string
    institution: string
    location?: string
    graduation_date?: string
    gpa?: string
  }>
  skills?: Array<{
    category: string
    items: string[]
  }>
  certifications?: Array<{
    name: string
    issuer: string
    date?: string
    url?: string
  }>
}
