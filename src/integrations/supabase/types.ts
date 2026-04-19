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
      blocked_customers: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          phone: string | null
          reason: string | null
          store_id: string
          user_id: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          store_id: string
          user_id?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      combo_items: {
        Row: {
          combo_id: string
          id: string
          position: number | null
          product_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          id?: string
          position?: number | null
          product_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          id?: string
          position?: number | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount: number
          coupon_id: string
          created_at: string
          customer_phone: string | null
          id: string
          order_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          coupon_id: string
          created_at?: string
          customer_phone?: string | null
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          coupon_id?: string
          created_at?: string
          customer_phone?: string | null
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          category_ids: string[] | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          label: string
          min_order: number | null
          per_user_limit: number
          starts_at: string | null
          store_id: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          usage_limit: number | null
          used_count: number
          value: number
          visibility: string
        }
        Insert: {
          active?: boolean
          category_ids?: string[] | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label: string
          min_order?: number | null
          per_user_limit?: number
          starts_at?: string | null
          store_id?: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          usage_limit?: number | null
          used_count?: number
          value?: number
          visibility?: string
        }
        Update: {
          active?: boolean
          category_ids?: string[] | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string
          min_order?: number | null
          per_user_limit?: number
          starts_at?: string | null
          store_id?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          usage_limit?: number | null
          used_count?: number
          value?: number
          visibility?: string
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
      loyalty_points: {
        Row: {
          created_at: string
          delta: number
          expires_at: string | null
          id: string
          order_id: string | null
          reason: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          reason: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          reason?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_store_id_fkey"
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
          available_from: string | null
          available_to: string | null
          bestseller: boolean
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          flash_discount_percent: number | null
          flash_promo: boolean
          id: string
          image_url: string | null
          is_combo: boolean
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
          available_from?: string | null
          available_to?: string | null
          bestseller?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          flash_discount_percent?: number | null
          flash_promo?: boolean
          id?: string
          image_url?: string | null
          is_combo?: boolean
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
          available_from?: string | null
          available_to?: string | null
          bestseller?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          flash_discount_percent?: number | null
          flash_promo?: boolean
          id?: string
          image_url?: string | null
          is_combo?: boolean
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
      reactivation_campaigns: {
        Row: {
          active: boolean
          coupon_validity_days: number
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          inactive_days: number
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          coupon_validity_days?: number
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          inactive_days?: number
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          coupon_validity_days?: number
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          inactive_days?: number
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_runs: {
        Row: {
          campaign_id: string
          coupon_code: string
          coupon_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          redeemed: boolean
          store_id: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          coupon_code: string
          coupon_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          redeemed?: boolean
          store_id: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          coupon_code?: string
          coupon_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          redeemed?: boolean
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reactivation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_runs_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_holidays: {
        Row: {
          close_time: string | null
          closed: boolean
          created_at: string
          date: string
          id: string
          label: string | null
          open_time: string | null
          store_id: string
        }
        Insert: {
          close_time?: string | null
          closed?: boolean
          created_at?: string
          date: string
          id?: string
          label?: string | null
          open_time?: string | null
          store_id: string
        }
        Update: {
          close_time?: string | null
          closed?: boolean
          created_at?: string
          date?: string
          id?: string
          label?: string | null
          open_time?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_holidays_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_loyalty_config: {
        Row: {
          enabled: boolean
          points_per_real: number
          redeem_points: number
          redeem_value: number
          store_id: string
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          enabled?: boolean
          points_per_real?: number
          redeem_points?: number
          redeem_value?: number
          store_id: string
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          enabled?: boolean
          points_per_real?: number
          redeem_points?: number
          redeem_value?: number
          store_id?: string
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_loyalty_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_neighborhoods: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          estimated_time_min: number | null
          fee: number
          id: string
          name: string
          store_id: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          estimated_time_min?: number | null
          fee?: number
          id?: string
          name: string
          store_id: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          estimated_time_min?: number | null
          fee?: number
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_neighborhoods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_methods: {
        Row: {
          active_from: string | null
          active_to: string | null
          created_at: string
          enabled: boolean
          id: string
          installments: number | null
          method: string
          notes: string | null
          store_id: string
        }
        Insert: {
          active_from?: string | null
          active_to?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          installments?: number | null
          method: string
          notes?: string | null
          store_id: string
        }
        Update: {
          active_from?: string | null
          active_to?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          installments?: number | null
          method?: string
          notes?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accept_alert_min: number
          address_cep: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          autocancel_enabled: boolean
          autocancel_min: number
          categories: string[] | null
          city: string | null
          courier_mode: string
          cover_url: string | null
          created_at: string
          cuisine: string | null
          delivery_fee: number | null
          delivery_fee_per_km: number | null
          delivery_mode: string
          delivery_radius_km: number | null
          delivery_time: string | null
          free_shipping_threshold: number | null
          id: string
          instagram: string | null
          lat: number | null
          lng: number | null
          logo: string | null
          marketplace_fee_percent: number
          max_orders_per_hour: number | null
          min_order: number | null
          name: string
          open: boolean
          opening_hours: Json | null
          owner_id: string | null
          phone: string | null
          pickup_enabled: boolean
          pickup_prep_time_min: number | null
          pix_key: string | null
          preorder_minutes: number | null
          promo: string | null
          rating: number | null
          reviews: number | null
          short_description: string | null
          slug: string
          sound_alerts_enabled: boolean
          tagline: string | null
          updated_at: string
          vacation_message: string | null
          vacation_mode: boolean
          vacation_until: string | null
          website: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          accept_alert_min?: number
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          city?: string | null
          courier_mode?: string
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          delivery_fee_per_km?: number | null
          delivery_mode?: string
          delivery_radius_km?: number | null
          delivery_time?: string | null
          free_shipping_threshold?: number | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo?: string | null
          marketplace_fee_percent?: number
          max_orders_per_hour?: number | null
          min_order?: number | null
          name: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_prep_time_min?: number | null
          pix_key?: string | null
          preorder_minutes?: number | null
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          short_description?: string | null
          slug: string
          sound_alerts_enabled?: boolean
          tagline?: string | null
          updated_at?: string
          vacation_message?: string | null
          vacation_mode?: boolean
          vacation_until?: string | null
          website?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          accept_alert_min?: number
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          city?: string | null
          courier_mode?: string
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          delivery_fee_per_km?: number | null
          delivery_mode?: string
          delivery_radius_km?: number | null
          delivery_time?: string | null
          free_shipping_threshold?: number | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo?: string | null
          marketplace_fee_percent?: number
          max_orders_per_hour?: number | null
          min_order?: number | null
          name?: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_prep_time_min?: number | null
          pix_key?: string | null
          preorder_minutes?: number | null
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          short_description?: string | null
          slug?: string
          sound_alerts_enabled?: boolean
          tagline?: string | null
          updated_at?: string
          vacation_message?: string | null
          vacation_mode?: boolean
          vacation_until?: string | null
          website?: string | null
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
      customer_points_balance: {
        Args: { _store_id: string; _user_id: string }
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
      run_reactivation_campaign: {
        Args: { _campaign_id: string }
        Returns: number
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
