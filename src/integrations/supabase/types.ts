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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      broadcasts: {
        Row: {
          content: string
          created_at: string
          id: string
          recipients_count: number
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipients_count?: number
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipients_count?: number
          sender_id?: string
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_id: string
          created_at: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user: string
          id: string
          payload: Json
          signal_type: string
          to_user: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user: string
          id?: string
          payload: Json
          signal_type: string
          to_user: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user?: string
          id?: string
          payload?: Json
          signal_type?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_theme: {
        Row: {
          accent_color: string
          background_style: string
          button_position: string
          camera_label: string
          custom_css: string
          hangup_label: string
          id: number
          mute_label: string
          primary_color: string
          show_participants: boolean
          show_timer: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_style?: string
          button_position?: string
          camera_label?: string
          custom_css?: string
          hangup_label?: string
          id?: number
          mute_label?: string
          primary_color?: string
          show_participants?: boolean
          show_timer?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_style?: string
          button_position?: string
          camera_label?: string
          custom_css?: string
          hangup_label?: string
          id?: number
          mute_label?: string
          primary_color?: string
          show_participants?: boolean
          show_timer?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          call_type: string
          callee_id: string | null
          caller_id: string
          conversation_id: string | null
          ended_at: string | null
          group_id: string | null
          id: string
          room_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          call_type?: string
          callee_id?: string | null
          caller_id: string
          conversation_id?: string | null
          ended_at?: string | null
          group_id?: string | null
          id?: string
          room_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          callee_id?: string | null
          caller_id?: string
          conversation_id?: string | null
          ended_at?: string | null
          group_id?: string | null
          id?: string
          room_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      global_announcements: {
        Row: {
          color: string
          created_at: string
          duration_ms: number
          icon: string
          id: string
          message: string
          sender_id: string
          style: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          duration_ms?: number
          icon?: string
          id?: string
          message: string
          sender_id: string
          style?: string
          title?: string
        }
        Update: {
          color?: string
          created_at?: string
          duration_ms?: number
          icon?: string
          id?: string
          message?: string
          sender_id?: string
          style?: string
          title?: string
        }
        Relationships: []
      }
      group_channels: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: []
      }
      group_member_roles: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          group_id: string
          id: string
          is_system: boolean
          media_type: string | null
          media_url: string | null
          sender_id: string
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string
          group_id: string
          id?: string
          is_system?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_id: string
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          is_system?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_initials: string
          avatar_url: string | null
          created_at: string
          description: string
          id: string
          last_message_at: string
          name: string
          owner_id: string
          write_mode: string
        }
        Insert: {
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          description?: string
          id?: string
          last_message_at?: string
          name: string
          owner_id: string
          write_mode?: string
        }
        Update: {
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          description?: string
          id?: string
          last_message_at?: string
          name?: string
          owner_id?: string
          write_mode?: string
        }
        Relationships: []
      }
      important_users: {
        Row: {
          created_at: string
          id: string
          marked_by: string
          note: string | null
          priority: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by: string
          note?: string | null
          priority?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string
          note?: string | null
          priority?: number
          user_id?: string
        }
        Relationships: []
      }
      live_events: {
        Row: {
          countdown_label: string
          created_at: string
          created_by: string
          description: string
          ended_at: string | null
          id: string
          is_active: boolean
          is_draft: boolean
          publish_at: string | null
          theme: Json
          title: string
        }
        Insert: {
          countdown_label?: string
          created_at?: string
          created_by: string
          description?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_draft?: boolean
          publish_at?: string | null
          theme?: Json
          title: string
        }
        Update: {
          countdown_label?: string
          created_at?: string
          created_by?: string
          description?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_draft?: boolean
          publish_at?: string | null
          theme?: Json
          title?: string
        }
        Relationships: []
      }
      live_updates: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_updates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy: number | null
          created_at: string
          id: string
          lat: number
          lng: number
          share_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          share_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "location_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      location_shares: {
        Row: {
          active: boolean
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          group_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          media_type: string | null
          media_url: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_dms: boolean
          avatar_initials: string
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          email_verified_at: string | null
          id: string
          is_banned: boolean
          is_official: boolean
          is_verified: boolean
          keyboard_enabled: boolean
          keyboard_theme: string
          language: string
          last_seen: string
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          allow_dms?: boolean
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          email_verified_at?: string | null
          id?: string
          is_banned?: boolean
          is_official?: boolean
          is_verified?: boolean
          keyboard_enabled?: boolean
          keyboard_theme?: string
          language?: string
          last_seen?: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          allow_dms?: boolean
          avatar_initials?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          email_verified_at?: string | null
          id?: string
          is_banned?: boolean
          is_official?: boolean
          is_verified?: boolean
          keyboard_enabled?: boolean
          keyboard_theme?: string
          language?: string
          last_seen?: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      scheduled_calls: {
        Row: {
          call_type: string
          created_at: string
          description: string
          group_id: string | null
          host_id: string
          id: string
          invitee_ids: string[]
          room_id: string
          scheduled_at: string
          share_link: string
          status: string
          title: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          description?: string
          group_id?: string | null
          host_id: string
          id?: string
          invitee_ids?: string[]
          room_id?: string
          scheduled_at: string
          share_link?: string
          status?: string
          title?: string
        }
        Update: {
          call_type?: string
          created_at?: string
          description?: string
          group_id?: string | null
          host_id?: string
          id?: string
          invitee_ids?: string[]
          room_id?: string
          scheduled_at?: string
          share_link?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      site_banner: {
        Row: {
          color: string
          cta_label: string
          enabled: boolean
          icon: string
          id: number
          link: string | null
          message: string
          position: string
          updated_at: string
        }
        Insert: {
          color?: string
          cta_label?: string
          enabled?: boolean
          icon?: string
          id?: number
          link?: string | null
          message?: string
          position?: string
          updated_at?: string
        }
        Update: {
          color?: string
          cta_label?: string
          enabled?: boolean
          icon?: string
          id?: number
          link?: string | null
          message?: string
          position?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_effects: {
        Row: {
          config: Json
          enabled: boolean
          expires_at: string | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          expires_at?: string | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          expires_at?: string | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          emoji: string
          enabled: boolean
          icon: string
          id: string
          position: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          enabled?: boolean
          icon?: string
          id?: string
          position?: number
          slug: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          emoji?: string
          enabled?: boolean
          icon?: string
          id?: string
          position?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          content: string
          enabled: boolean
          id: string
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          enabled?: boolean
          id?: string
          key: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          enabled?: boolean
          id?: string
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          author_id: string
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          media_type: string | null
          media_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          subscriber_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          subscriber_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          subscriber_id?: string
        }
        Relationships: []
      }
      ui_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_mutes: {
        Row: {
          created_at: string
          id: string
          muted_by: string
          muted_until: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_by: string
          muted_until: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_by?: string
          muted_until?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      conversation_has_official: { Args: { _conv: string }; Returns: boolean }
      get_group_role: {
        Args: { _group: string; _user: string }
        Returns: Database["public"]["Enums"]["group_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_mod_or_owner: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_user_muted: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      group_role: "owner" | "moderator" | "member"
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
    Enums: {
      app_role: ["admin", "user"],
      group_role: ["owner", "moderator", "member"],
    },
  },
} as const
