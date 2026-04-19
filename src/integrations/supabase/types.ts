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
      addon_groups: {
        Row: {
          id: string
          max_select: number | null
          min_select: number
          name: string
          position: number | null
          product_id: string
          required: boolean
          type: Database["public"]["Enums"]["addon_type"]
        }
        Insert: {
          id?: string
          max_select?: number | null
          min_select?: number
          name: string
          position?: number | null
          product_id: string
          required?: boolean
          type?: Database["public"]["Enums"]["addon_type"]
        }
        Update: {
          id?: string
          max_select?: number | null
          min_select?: number
          name?: string
          position?: number | null
          product_id?: string
          required?: boolean
          type?: Database["public"]["Enums"]["addon_type"]
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_options: {
        Row: {
          group_id: string
          id: string
          name: string
          position: number | null
          price: number
        }
        Insert: {
          group_id: string
          id?: string
          name: string
          position?: number | null
          price?: number
        }
        Update: {
          group_id?: string
          id?: string
          name?: string
          position?: number | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "addon_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          position: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          position?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          label: string
          min_order: number | null
          store_id: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label: string
          min_order?: number | null
          store_id?: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string
          min_order?: number | null
          store_id?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          customizations: Json | null
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          customizations?: Json | null
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          customizations?: Json | null
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          address: Json | null
          cancel_by: Database["public"]["Enums"]["cancel_source"] | null
          cancel_reason: string | null
          cashback_earned: number
          cashback_used: number
          change_for: number | null
          coupon_code: string | null
          coupon_discount: number
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          id: string
          method: Database["public"]["Enums"]["delivery_method"]
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          address?: Json | null
          cancel_by?: Database["public"]["Enums"]["cancel_source"] | null
          cancel_reason?: string | null
          cashback_earned?: number
          cashback_used?: number
          change_for?: number | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          method?: Database["public"]["Enums"]["delivery_method"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: Json | null
          cancel_by?: Database["public"]["Enums"]["cancel_source"] | null
          cancel_reason?: string | null
          cashback_earned?: number
          cashback_used?: number
          change_for?: number | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          method?: Database["public"]["Enums"]["delivery_method"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_orders: {
        Row: {
          order_id: string
          payout_id: string
        }
        Insert: {
          order_id: string
          payout_id: string
        }
        Update: {
          order_id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_orders_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          net_amount: number
          orders_count: number
          paid_at: string | null
          period_end: string
          period_start: string
          scheduled_for: string
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          orders_count?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          orders_count?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          archived_at: string | null
          bestseller: boolean
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_new: boolean
          name: string
          old_price: number | null
          position: number | null
          prep_time_min: number | null
          price: number
          promo: boolean
          promo_ends_at: string | null
          promo_starts_at: string | null
          rating: number | null
          reviews: number | null
          stock: number | null
          store_id: string
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          bestseller?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_new?: boolean
          name: string
          old_price?: number | null
          position?: number | null
          prep_time_min?: number | null
          price: number
          promo?: boolean
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          rating?: number | null
          reviews?: number | null
          stock?: number | null
          store_id: string
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          bestseller?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_new?: boolean
          name?: string
          old_price?: number | null
          position?: number | null
          prep_time_min?: number | null
          price?: number
          promo?: boolean
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          rating?: number | null
          reviews?: number | null
          stock?: number | null
          store_id?: string
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          accept_alert_min: number
          autocancel_enabled: boolean
          autocancel_min: number
          categories: string[] | null
          city: string | null
          cover_url: string | null
          created_at: string
          cuisine: string | null
          delivery_fee: number | null
          delivery_time: string | null
          free_shipping_threshold: number | null
          id: string
          logo: string | null
          marketplace_fee_percent: number
          min_order: number | null
          name: string
          open: boolean
          opening_hours: Json | null
          owner_id: string | null
          promo: string | null
          rating: number | null
          reviews: number | null
          slug: string
          sound_alerts_enabled: boolean
          tagline: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          accept_alert_min?: number
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          delivery_time?: string | null
          free_shipping_threshold?: number | null
          id?: string
          logo?: string | null
          marketplace_fee_percent?: number
          min_order?: number | null
          name: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          slug: string
          sound_alerts_enabled?: boolean
          tagline?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          accept_alert_min?: number
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          delivery_time?: string | null
          free_shipping_threshold?: number | null
          id?: string
          logo?: string | null
          marketplace_fee_percent?: number
          min_order?: number | null
          name?: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          slug?: string
          sound_alerts_enabled?: boolean
          tagline?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          cep: string
          city: string | null
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          neighborhood: string | null
          number: string
          street: string
          user_id: string
        }
        Insert: {
          cep: string
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number: string
          street: string
          user_id: string
        }
        Update: {
          cep?: string
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string
          street?: string
          user_id?: string
        }
        Relationships: []
      }
      user_loyalty: {
        Row: {
          cashback: number
          orders_count: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cashback?: number
          orders_count?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cashback?: number
          orders_count?: number
          total_spent?: number
          updated_at?: string
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
      apply_order_loyalty: {
        Args: { _cashback_used: number; _order_total: number }
        Returns: number
      }
      generate_weekly_payouts: { Args: { _store_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      addon_type: "single" | "multi"
      app_role: "admin" | "store_owner" | "customer"
      cancel_source: "store" | "system" | "customer" | "courier"
      coupon_type: "percent" | "fixed" | "free_shipping"
      delivery_method: "delivery" | "pickup"
      order_status:
        | "pending_payment"
        | "received"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "pix" | "cash" | "credit" | "debit"
      payout_status: "scheduled" | "processing" | "paid"
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
      addon_type: ["single", "multi"],
      app_role: ["admin", "store_owner", "customer"],
      cancel_source: ["store", "system", "customer", "courier"],
      coupon_type: ["percent", "fixed", "free_shipping"],
      delivery_method: ["delivery", "pickup"],
      order_status: [
        "pending_payment",
        "received",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["pix", "cash", "credit", "debit"],
      payout_status: ["scheduled", "processing", "paid"],
    },
  },
} as const
