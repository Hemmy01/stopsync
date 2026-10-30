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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bus_events: {
        Row: {
          boarded_count: number | null
          bus_id: string
          created_at: string
          delta: number | null
          event: string
          id: number
          occupancy: number | null
          source: string
          stop_id: string | null
        }
        Insert: {
          boarded_count?: number | null
          bus_id: string
          created_at?: string
          delta?: number | null
          event: string
          id?: never
          occupancy?: number | null
          source: string
          stop_id?: string | null
        }
        Update: {
          boarded_count?: number | null
          bus_id?: string
          created_at?: string
          delta?: number | null
          event?: string
          id?: never
          occupancy?: number | null
          source?: string
          stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_events_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_events_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_positions: {
        Row: {
          accuracy: number | null
          bus_id: string
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          bus_id: string
          id?: never
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          bus_id?: string
          id?: never
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_positions_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          departed_at: string | null
          destination: string
          distance_remaining_m: number | null
          eta_minutes: number | null
          id: string
          last_stop_id: string | null
          lat: number | null
          lng: number | null
          location_updated_at: string | null
          next_stop_id: string | null
          occupancy: number
          released_at: string | null
          seats: number
          standing: number
          status: string
          stops_remaining: number | null
        }
        Insert: {
          departed_at?: string | null
          destination: string
          distance_remaining_m?: number | null
          eta_minutes?: number | null
          id: string
          last_stop_id?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          next_stop_id?: string | null
          occupancy?: number
          released_at?: string | null
          seats?: number
          standing?: number
          status?: string
          stops_remaining?: number | null
        }
        Update: {
          departed_at?: string | null
          destination?: string
          distance_remaining_m?: number | null
          eta_minutes?: number | null
          id?: string
          last_stop_id?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          next_stop_id?: string | null
          occupancy?: number
          released_at?: string | null
          seats?: number
          standing?: number
          status?: string
          stops_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buses_destination_fkey"
            columns: ["destination"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "buses_last_stop_id_fkey"
            columns: ["last_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buses_next_stop_id_fkey"
            columns: ["next_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      cancel_reasons: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      config: {
        Row: {
          description: string | null
          key: string
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          value?: number
        }
        Relationships: []
      }
      destinations: {
        Row: {
          bus_capacity: number
          code: string
          gesture_hint: string | null
          gesture_label: string | null
          name: string
          route: string
          sort_order: number
          voice_label: string | null
        }
        Insert: {
          bus_capacity?: number
          code: string
          gesture_hint?: string | null
          gesture_label?: string | null
          name: string
          route: string
          sort_order?: number
          voice_label?: string | null
        }
        Update: {
          bus_capacity?: number
          code?: string
          gesture_hint?: string | null
          gesture_label?: string | null
          name?: string
          route?: string
          sort_order?: number
          voice_label?: string | null
        }
        Relationships: []
      }
      dispatch_decisions: {
        Row: {
          action: string
          created_at: string
          decided_at: string | null
          destination: string
          id: number
          load_pct: number
          oldest_wait_min: number | null
          reason: string
          status: string
          waiting: number
        }
        Insert: {
          action: string
          created_at?: string
          decided_at?: string | null
          destination: string
          id?: never
          load_pct: number
          oldest_wait_min?: number | null
          reason: string
          status?: string
          waiting: number
        }
        Update: {
          action?: string
          created_at?: string
          decided_at?: string | null
          destination?: string
          id?: never
          load_pct?: number
          oldest_wait_min?: number | null
          reason?: string
          status?: string
          waiting?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_decisions_destination_fkey"
            columns: ["destination"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
        ]
      }
      queue_tokens: {
        Row: {
          boarded_at: string | null
          bus_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          card_id: string | null
          code: string
          completed_at: string | null
          confidence: number | null
          created_at: string
          destination: string
          id: number
          method: string
          status: string
          stop_id: string
        }
        Insert: {
          boarded_at?: string | null
          bus_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_id?: string | null
          code: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          destination: string
          id?: never
          method: string
          status?: string
          stop_id: string
        }
        Update: {
          boarded_at?: string | null
          bus_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_id?: string | null
          code?: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          destination?: string
          id?: never
          method?: string
          status?: string
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_tokens_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_tokens_cancel_reason_fkey"
            columns: ["cancel_reason"]
            isOneToOne: false
            referencedRelation: "cancel_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "queue_tokens_destination_fkey"
            columns: ["destination"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "queue_tokens_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes_stops: {
        Row: {
          distance_from_terminal_m: number
          route: string
          seq: number
          stop_id: string
        }
        Insert: {
          distance_from_terminal_m: number
          route: string
          seq: number
          stop_id: string
        }
        Update: {
          distance_from_terminal_m?: number
          route?: string
          seq?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_events: {
        Row: {
          confidence: number | null
          created_at: string
          destination: string
          id: number
          method: string
          outcome: string
          stop_id: string
          token_code: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          destination: string
          id?: never
          method: string
          outcome: string
          stop_id: string
          token_code?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          destination?: string
          id?: never
          method?: string
          outcome?: string
          stop_id?: string
          token_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selection_events_destination_fkey"
            columns: ["destination"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "selection_events_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          id: string
          lat: number | null
          lng: number | null
          name: string
        }
        Insert: {
          id: string
          lat?: number | null
          lng?: number | null
          name: string
        }
        Update: {
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
        }
        Relationships: []
      }
      terminals: {
        Row: {
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          route: string
          stop_id: string
        }
        Insert: {
          id: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          route: string
          stop_id: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          route?: string
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminals_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      model_insights_today: {
        Row: {
          avg_confidence: number | null
          cancelled_or_timeout: number | null
          changed: number | null
          confirmation_rate: number | null
          confirmed: number | null
          method: string | null
          selections: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_occupancy: {
        Args: { p_bus: string; p_delta: number }
        Returns: Json
      }
      approve_decision: { Args: { p_decision: number }; Returns: Json }
      board_queue: { Args: { p_bus: string; p_stop: string }; Returns: Json }
      bus_free_places: {
        Args: { b: Database["public"]["Tables"]["buses"]["Row"] }
        Returns: number
      }
      cancel_token: {
        Args: { p_card: string; p_reason: string }
        Returns: Json
      }
      complete_trip: {
        Args: { p_bus: string; p_source?: string }
        Returns: Json
      }
      config_value: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      create_token: {
        Args: {
          p_card: string
          p_conf?: number
          p_dest: string
          p_method: string
          p_stop: string
        }
        Returns: Json
      }
      dismiss_decision: { Args: { p_decision: number }; Returns: Json }
      haversine_m: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      kiosk_stop_id: { Args: never; Returns: string }
      log_selection: {
        Args: {
          p_conf: number
          p_dest: string
          p_method: string
          p_outcome: string
          p_stop: string
          p_token?: string
        }
        Returns: Json
      }
      mark_bus_arrived: {
        Args: { p_bus: string; p_source?: string }
        Returns: Json
      }
      prune_bus_positions: { Args: never; Returns: number }
      release_for_decision: {
        Args: { p_decision: number; p_source: string }
        Returns: Json
      }
      reset_bus: { Args: { p_bus: string }; Returns: Json }
      reset_demo: { Args: never; Returns: Json }
      route_progress: {
        Args: { p_lat: number; p_lng: number; p_route: string }
        Returns: {
          off_route_m: number
          progress_m: number
        }[]
      }
      run_dispatch: { Args: never; Returns: undefined }
      update_bus_location:
        | {
            Args: { p_bus: string; p_lat: number; p_lng: number }
            Returns: Json
          }
        | {
            Args: {
              p_accuracy: number
              p_bus: string
              p_lat: number
              p_lng: number
              p_speed: number
            }
            Returns: Json
          }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
