export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: string;
          avatar_url: string | null;
          phone: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          role?: string;
          avatar_url?: string | null;
          phone?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          display_name?: string;
          role?: string;
          avatar_url?: string | null;
          phone?: string;
          active?: boolean;
        };
      };
      orders: {
        Row: {
          id: string;
          client_name: string;
          phone: string;
          city: string;
          address: string;
          product: string;
          quantity: number;
          price: number;
          comments: string | null;
          order_date: string;
          source: string;
          status: string;
          claimed_by: string | null;
          claimed_at: string | null;
          sheet_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_name: string;
          phone: string;
          city?: string;
          address?: string;
          product?: string;
          quantity?: number;
          price?: number;
          comments?: string | null;
          order_date?: string;
          source?: string;
          status?: string;
          claimed_by?: string | null;
          claimed_at?: string | null;
          sheet_row_id?: string | null;
        };
        Update: {
          client_name?: string;
          phone?: string;
          city?: string;
          address?: string;
          product?: string;
          quantity?: number;
          price?: number;
          comments?: string | null;
          order_date?: string;
          source?: string;
          status?: string;
          claimed_by?: string | null;
          claimed_at?: string | null;
        };
      };
      order_history: {
        Row: {
          id: string;
          order_id: string;
          user_id: string | null;
          user_name: string;
          action: string;
          details: string | null;
          created_at: string;
        };
        Insert: {
          order_id: string;
          user_id?: string | null;
          user_name?: string;
          action: string;
          details?: string | null;
        };
      };
      order_notes: {
        Row: {
          id: string;
          order_id: string;
          user_id: string | null;
          user_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          order_id: string;
          user_id?: string | null;
          user_name?: string;
          content: string;
        };
      };
      sheets_config: {
        Row: {
          id: string;
          name: string;
          sheet_url: string;
          sheet_gid: string;
          last_synced: string | null;
          sync_enabled: boolean;
          column_mapping: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          sheet_url: string;
          sheet_gid?: string;
          column_mapping?: Json;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          sheet_url?: string;
          sheet_gid?: string;
          last_synced?: string | null;
          sync_enabled?: boolean;
          column_mapping?: Json;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          user_name: string;
          user_role: string | null;
          action: string;
          details: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          user_name?: string;
          user_role?: string | null;
          action: string;
          details?: string | null;
          ip_address?: string | null;
        };
      };
    };
    Functions: {
      search_orders: {
        Args: { search_query: string };
        Returns: Record<string, any>[];
      };
      get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
  };
}
