export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_activity: {
        Row: {
          activity_date: string
          created_at: string
          id: string
          queries_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          created_at?: string
          id?: string
          queries_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          id?: string
          queries_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          badges: string[] | null
          browser_fingerprint: string | null
          created_at: string
          current_streak: number
          highest_streak: number
          id: string
          last_seen: string
          level: number
          nickname: string
          queries_executed: number
          rows_inserted: number
          tables_created: number
          updated_at: string
          user_id: string | null
          xp: number
        }
        Insert: {
          badges?: string[] | null
          browser_fingerprint?: string | null
          created_at?: string
          current_streak?: number
          highest_streak?: number
          id?: string
          last_seen?: string
          level?: number
          nickname: string
          queries_executed?: number
          rows_inserted?: number
          tables_created?: number
          updated_at?: string
          user_id?: string | null
          xp?: number
        }
        Update: {
          badges?: string[] | null
          browser_fingerprint?: string | null
          created_at?: string
          current_streak?: number
          highest_streak?: number
          id?: string
          last_seen?: string
          level?: number
          nickname?: string
          queries_executed?: number
          rows_inserted?: number
          tables_created?: number
          updated_at?: string
          user_id?: string | null
          xp?: number
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          backoff_until: string | null
          created_at: string
          endpoint: string
          id: string
          identifier: string
          last_request: string
          request_count: number
          window_start: string
        }
        Insert: {
          backoff_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          identifier: string
          last_request?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          backoff_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          last_request?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      rdbms_query_history: {
        Row: {
          created_at: string
          execution_time_ms: number | null
          id: string
          query: string
          result: Json | null
          session_id: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          query: string
          result?: Json | null
          session_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          query?: string
          result?: Json | null
          session_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      rdbms_rows: {
        Row: {
          created_at: string
          data: Json
          id: string
          session_id: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          session_id?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          session_id?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdbms_rows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "rdbms_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      rdbms_tables: {
        Row: {
          columns: Json
          created_at: string
          id: string
          indexes: Json
          session_id: string | null
          table_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          indexes?: Json
          session_id?: string | null
          table_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          indexes?: Json
          session_id?: string | null
          table_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_public: {
        Row: {
          badges: string[] | null
          created_at: string | null
          current_streak: number | null
          highest_streak: number | null
          id: string | null
          last_seen: string | null
          level: number | null
          nickname: string | null
          queries_executed: number | null
          rows_inserted: number | null
          tables_created: number | null
          xp: number | null
        }
        Insert: {
          badges?: string[] | null
          created_at?: string | null
          current_streak?: number | null
          highest_streak?: number | null
          id?: string | null
          last_seen?: string | null
          level?: number | null
          nickname?: string | null
          queries_executed?: number | null
          rows_inserted?: number | null
          tables_created?: number | null
          xp?: number | null
        }
        Update: {
          badges?: string[] | null
          created_at?: string | null
          current_streak?: number | null
          highest_streak?: number | null
          id?: string | null
          last_seen?: string | null
          level?: number | null
          nickname?: string | null
          queries_executed?: number | null
          rows_inserted?: number | null
          tables_created?: number | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_session_data: { Args: { p_session_id: string }; Returns: undefined }
      cleanup_inactive_users: { Args: never; Returns: undefined }
      compute_user_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          highest_streak: number
        }[]
      }
      get_leaderboard_public: {
        Args: never
        Returns: {
          badges: string[]
          created_at: string
          current_streak: number
          highest_streak: number
          id: string
          level: number
          nickname: string
          queries_executed: number
          rows_inserted: number
          tables_created: number
          xp: number
        }[]
      }
      record_query_activity: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
