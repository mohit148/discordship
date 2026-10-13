// This file mirrors supabase/schema.sql by hand, as a reference while you
// don't yet have a linked Supabase project. It is NOT currently wired into
// the clients in client.ts / server.ts — hand-rolled Database types can
// produce confusing "never" type errors with supabase-js's generic helpers
// unless every field (Views, Functions, Enums, CompositeTypes) is present.
//
// Once your project is linked, generate the real thing and use it instead:
//   npx supabase gen types typescript --project-id <your-project-ref> > lib/supabase/types.ts
// then parameterize createClient<Database>() / createServerClient<Database>()
// in client.ts and server.ts.

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          discord_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          discord_id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      ships: {
        Row: {
          id: string;
          number: number;
          user_a_id: string;
          user_b_id: string;
          status: "confirmed" | "pending" | "ended" | "archived";
          is_two_auth: boolean;
          custom_text: string | null;
          custom_text_pending: string | null;
          custom_text_proposed_by: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
          ended_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ships"]["Row"], "id" | "number" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["ships"]["Insert"]>;
      };
      ship_requests: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          status: "pending" | "accepted" | "declined" | "cancelled";
          created_at: string;
          responded_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ship_requests"]["Row"], "id" | "created_at" | "responded_at">;
        Update: Partial<Database["public"]["Tables"]["ship_requests"]["Insert"]>;
      };
      ship_history: {
        Row: {
          id: string;
          ship_id: string;
          action: string;
          actor_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ship_history"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ship_history"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          ship_id: string | null;
          reported_by: string;
          reason: string;
          status: "open" | "resolved" | "dismissed";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reports"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: "ship" | "user" | "request" | "report" | "settings";
          target_id: string | null;
          detail: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
  };
}
