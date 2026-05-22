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
      abandoned_carts: {
        Row: {
          created_at: string
          estimated_total: number
          id: string
          items: Json
          notified_at: string | null
          recovered_at: string | null
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_total?: number
          id?: string
          items?: Json
          notified_at?: string | null
          recovered_at?: string | null
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_total?: number
          id?: string
          items?: Json
          notified_at?: string | null
          recovered_at?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_campaigns: {
        Row: {
          active: boolean
          coupon_validity_days: number
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          message: string | null
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
          message?: string | null
          name?: string
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
          message?: string | null
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_runs: {
        Row: {
          campaign_id: string
          coupon_code: string
          coupon_id: string | null
          created_at: string
          id: string
          redeemed: boolean
          store_id: string
          user_id: string
          year: number
        }
        Insert: {
          campaign_id: string
          coupon_code: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          redeemed?: boolean
          store_id: string
          user_id: string
          year: number
        }
        Update: {
          campaign_id?: string
          coupon_code?: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          redeemed?: boolean
          store_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "birthday_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "birthday_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_runs_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          id: string
          order_id: string | null
          payment_method: string | null
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          counted_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          initial_amount: number
          notes: string | null
          opened_at: string
          opened_by: string | null
          opened_by_name: string | null
          status: string
          store_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          counted_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          status?: string
          store_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          counted_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          initial_amount?: number
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_store_id_fkey"
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
      courier_location_history: {
        Row: {
          accuracy: number | null
          courier_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          order_id: string
          recorded_at: string
          speed: number | null
          store_id: string
        }
        Insert: {
          accuracy?: number | null
          courier_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          order_id: string
          recorded_at?: string
          speed?: number | null
          store_id: string
        }
        Update: {
          accuracy?: number | null
          courier_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          order_id?: string
          recorded_at?: string
          speed?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_location_history_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_location_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_location_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          accuracy: number | null
          courier_id: string
          heading: number | null
          lat: number
          lng: number
          speed: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          courier_id: string
          heading?: number | null
          lat: number
          lng: number
          speed?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          courier_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          speed?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_online: boolean
          name: string
          phone: string | null
          photo_url: string | null
          store_id: string
          updated_at: string
          user_id: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_online?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          store_id: string
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_online?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "couriers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          position: number
          store_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          position?: number
          store_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          paid: boolean
          paid_at: string | null
          receipt_url: string | null
          recurrence: string | null
          recurring: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
          recurrence?: string | null
          recurring?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
          recurrence?: string | null
          recurring?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listing_visits: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      external_listings: {
        Row: {
          active: boolean
          address: string | null
          catalog_url: string
          category_key: string
          created_at: string
          created_by: string | null
          delivery_fee: number | null
          delivery_radius_km: number | null
          delivery_time: string | null
          id: string
          lat: number | null
          lng: number | null
          logo: string | null
          name: string
          opening_hours: Json | null
          subcategory_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          catalog_url: string
          category_key: string
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          delivery_radius_km?: number | null
          delivery_time?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo?: string | null
          name: string
          opening_hours?: Json | null
          subcategory_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          catalog_url?: string
          category_key?: string
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          delivery_radius_km?: number | null
          delivery_time?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo?: string | null
          name?: string
          opening_hours?: Json | null
          subcategory_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      favorite_external_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          access_key: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_cpf: string | null
          customer_name: string | null
          emitted_at: string | null
          error_message: string | null
          id: string
          numero: number | null
          order_id: string
          pdf_url: string | null
          protocol: string | null
          provider: string | null
          raw_response: Json | null
          serie: number | null
          status: string
          store_id: string
          total: number
          type: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name?: string | null
          emitted_at?: string | null
          error_message?: string | null
          id?: string
          numero?: number | null
          order_id: string
          pdf_url?: string | null
          protocol?: string | null
          provider?: string | null
          raw_response?: Json | null
          serie?: number | null
          status?: string
          store_id: string
          total: number
          type?: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name?: string | null
          emitted_at?: string | null
          error_message?: string | null
          id?: string
          numero?: number | null
          order_id?: string
          pdf_url?: string | null
          protocol?: string | null
          provider?: string | null
          raw_response?: Json | null
          serie?: number | null
          status?: string
          store_id?: string
          total?: number
          type?: string
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      home_banners: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          link_url: string | null
          position: number
          starts_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          link_url?: string | null
          position?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          link_url?: string | null
          position?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
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
      loyalty_redemptions: {
        Row: {
          coupon_code: string
          coupon_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          points_spent: number
          reward_id: string
          status: string
          store_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          coupon_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points_spent: number
          reward_id: string
          status?: string
          store_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          coupon_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points_spent?: number
          reward_id?: string
          status?: string
          store_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          cost_points: number
          created_at: string
          description: string | null
          free_product_id: string | null
          id: string
          name: string
          position: number
          reward_type: string
          reward_value: number
          stock: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_points: number
          created_at?: string
          description?: string | null
          free_product_id?: string | null
          id?: string
          name: string
          position?: number
          reward_type: string
          reward_value?: number
          stock?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_points?: number
          created_at?: string
          description?: string | null
          free_product_id?: string | null
          id?: string
          name?: string
          position?: number
          reward_type?: string
          reward_value?: number
          stock?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_free_product_id_fkey"
            columns: ["free_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read: boolean
          read_at: string | null
          store_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          store_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          store_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
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
          courier_id: string | null
          courier_tracking_notes: string | null
          courier_tracking_provider: string | null
          courier_tracking_url: string | null
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
          source: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          table_number: number | null
          table_session_id: string | null
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
          courier_id?: string | null
          courier_tracking_notes?: string | null
          courier_tracking_provider?: string | null
          courier_tracking_url?: string | null
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
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          table_number?: number | null
          table_session_id?: string | null
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
          courier_id?: string | null
          courier_tracking_notes?: string | null
          courier_tracking_provider?: string | null
          courier_tracking_url?: string | null
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
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          table_number?: number | null
          table_session_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          access_token_secret_name: string | null
          active: boolean
          created_at: string
          id: string
          is_default: boolean
          marketplace_fee_percent: number
          notes: string | null
          provider: string
          sandbox: boolean
          split_enabled: boolean
          split_recipient_id: string | null
          store_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token_secret_name?: string | null
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          marketplace_fee_percent?: number
          notes?: string | null
          provider: string
          sandbox?: boolean
          split_enabled?: boolean
          split_recipient_id?: string | null
          store_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token_secret_name?: string | null
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          marketplace_fee_percent?: number
          notes?: string | null
          provider?: string
          sandbox?: boolean
          split_enabled?: boolean
          split_recipient_id?: string | null
          store_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          external_id: string | null
          fee_amount: number | null
          gateway: string
          id: string
          method: string
          net_amount: number | null
          order_id: string | null
          paid_at: string | null
          qr_code_base64: string | null
          qr_code_payload: string | null
          raw_response: Json | null
          raw_webhook: Json | null
          status: string
          store_id: string
          table_session_id: string | null
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          fee_amount?: number | null
          gateway: string
          id?: string
          method?: string
          net_amount?: number | null
          order_id?: string | null
          paid_at?: string | null
          qr_code_base64?: string | null
          qr_code_payload?: string | null
          raw_response?: Json | null
          raw_webhook?: Json | null
          status?: string
          store_id: string
          table_session_id?: string | null
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          fee_amount?: number | null
          gateway?: string
          id?: string
          method?: string
          net_amount?: number | null
          order_id?: string | null
          paid_at?: string | null
          qr_code_base64?: string | null
          qr_code_payload?: string | null
          raw_response?: Json | null
          raw_webhook?: Json | null
          status?: string
          store_id?: string
          table_session_id?: string | null
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
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
      pdv_payments: {
        Row: {
          amount: number
          change_given: number
          created_at: string
          id: string
          method: string
          order_id: string
          store_id: string
        }
        Insert: {
          amount: number
          change_given?: number
          created_at?: string
          id?: string
          method: string
          order_id: string
          store_id: string
        }
        Update: {
          amount?: number
          change_given?: number
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          metadata: Json | null
          severity: string
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          severity?: string
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          severity?: string
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
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
          barcode: string | null
          bestseller: boolean
          brand: string | null
          category: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          flash_discount_percent: number | null
          flash_promo: boolean
          id: string
          image_url: string | null
          is_combo: boolean
          is_new: boolean
          location: string | null
          min_stock: number | null
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
          sku: string | null
          stock: number | null
          store_id: string
          supplier_id: string | null
          track_stock: boolean
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          available_from?: string | null
          available_to?: string | null
          barcode?: string | null
          bestseller?: boolean
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          flash_discount_percent?: number | null
          flash_promo?: boolean
          id?: string
          image_url?: string | null
          is_combo?: boolean
          is_new?: boolean
          location?: string | null
          min_stock?: number | null
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
          sku?: string | null
          stock?: number | null
          store_id: string
          supplier_id?: string | null
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          available_from?: string | null
          available_to?: string | null
          barcode?: string | null
          bestseller?: boolean
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          flash_discount_percent?: number | null
          flash_promo?: boolean
          id?: string
          image_url?: string | null
          is_combo?: boolean
          is_new?: boolean
          location?: string | null
          min_stock?: number | null
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
          sku?: string | null
          stock?: number | null
          store_id?: string
          supplier_id?: string | null
          track_stock?: boolean
          unit?: string | null
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
          birthday: string | null
          cpf: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          cpf?: string | null
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
      sectors: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          position: number
          store_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          store_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          store_id: string
          user_id: string | null
          user_label: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          store_id: string
          user_id?: string | null
          user_label?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          store_id?: string
          user_id?: string | null
          user_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      store_fiscal_config: {
        Row: {
          ambiente: string
          certificate_secret_name: string | null
          cfop_padrao: string | null
          cnpj: string | null
          csc_id: string | null
          csc_token_secret_name: string | null
          csosn_padrao: string | null
          enabled: boolean
          ie: string | null
          ie_isenta: boolean
          ncm_padrao: string | null
          provider: string | null
          regime_tributario: string | null
          serie: number
          store_id: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ambiente?: string
          certificate_secret_name?: string | null
          cfop_padrao?: string | null
          cnpj?: string | null
          csc_id?: string | null
          csc_token_secret_name?: string | null
          csosn_padrao?: string | null
          enabled?: boolean
          ie?: string | null
          ie_isenta?: boolean
          ncm_padrao?: string | null
          provider?: string | null
          regime_tributario?: string | null
          serie?: number
          store_id: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ambiente?: string
          certificate_secret_name?: string | null
          cfop_padrao?: string | null
          cnpj?: string | null
          csc_id?: string | null
          csc_token_secret_name?: string | null
          csosn_padrao?: string | null
          enabled?: boolean
          ie?: string | null
          ie_isenta?: boolean
          ncm_padrao?: string | null
          provider?: string | null
          regime_tributario?: string | null
          serie?: number
          store_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_fiscal_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
      store_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
          store_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          store_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_invites_store_id_fkey"
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
      store_members: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["staff_role"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          role: Database["public"]["Enums"]["staff_role"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["staff_role"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
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
      store_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          gateway: string | null
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          id: string
          monthly_amount: number
          next_payment_at: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          monthly_amount?: number
          next_payment_at?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          monthly_amount?: number
          next_payment_at?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
          auto_print_enabled: boolean
          autocancel_enabled: boolean
          autocancel_min: number
          categories: string[] | null
          chatbot_connected_at: string | null
          chatbot_n8n_webhook_url: string | null
          chatbot_phone: string | null
          chatbot_qr_code: string | null
          chatbot_qr_updated_at: string | null
          chatbot_status: string | null
          city: string | null
          courier_gps_alert_min: number
          courier_gps_reassign_min: number
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
          lifecycle_changed_at: string | null
          lifecycle_reason: string | null
          lifecycle_status: Database["public"]["Enums"]["store_lifecycle"]
          lng: number | null
          logistics_pickup_enabled: boolean
          logo: string | null
          marketplace_fee_percent: number
          max_orders_per_hour: number | null
          min_order: number | null
          name: string
          open: boolean
          opening_hours: Json | null
          owner_id: string | null
          pdv_enabled: boolean
          phone: string | null
          pickup_enabled: boolean
          pickup_prep_time_min: number | null
          pix_key: string | null
          preorder_minutes: number | null
          print_format: string
          promo: string | null
          rating: number | null
          reviews: number | null
          service_fee_default_on: boolean
          service_fee_percent: number
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
          auto_print_enabled?: boolean
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          chatbot_connected_at?: string | null
          chatbot_n8n_webhook_url?: string | null
          chatbot_phone?: string | null
          chatbot_qr_code?: string | null
          chatbot_qr_updated_at?: string | null
          chatbot_status?: string | null
          city?: string | null
          courier_gps_alert_min?: number
          courier_gps_reassign_min?: number
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
          lifecycle_changed_at?: string | null
          lifecycle_reason?: string | null
          lifecycle_status?: Database["public"]["Enums"]["store_lifecycle"]
          lng?: number | null
          logistics_pickup_enabled?: boolean
          logo?: string | null
          marketplace_fee_percent?: number
          max_orders_per_hour?: number | null
          min_order?: number | null
          name: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          pdv_enabled?: boolean
          phone?: string | null
          pickup_enabled?: boolean
          pickup_prep_time_min?: number | null
          pix_key?: string | null
          preorder_minutes?: number | null
          print_format?: string
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          service_fee_default_on?: boolean
          service_fee_percent?: number
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
          auto_print_enabled?: boolean
          autocancel_enabled?: boolean
          autocancel_min?: number
          categories?: string[] | null
          chatbot_connected_at?: string | null
          chatbot_n8n_webhook_url?: string | null
          chatbot_phone?: string | null
          chatbot_qr_code?: string | null
          chatbot_qr_updated_at?: string | null
          chatbot_status?: string | null
          city?: string | null
          courier_gps_alert_min?: number
          courier_gps_reassign_min?: number
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
          lifecycle_changed_at?: string | null
          lifecycle_reason?: string | null
          lifecycle_status?: Database["public"]["Enums"]["store_lifecycle"]
          lng?: number | null
          logistics_pickup_enabled?: boolean
          logo?: string | null
          marketplace_fee_percent?: number
          max_orders_per_hour?: number | null
          min_order?: number | null
          name?: string
          open?: boolean
          opening_hours?: Json | null
          owner_id?: string | null
          pdv_enabled?: boolean
          phone?: string | null
          pickup_enabled?: boolean
          pickup_prep_time_min?: number | null
          pix_key?: string | null
          preorder_minutes?: number | null
          print_format?: string
          promo?: string | null
          rating?: number | null
          reviews?: number | null
          service_fee_default_on?: boolean
          service_fee_percent?: number
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
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          name: string
          price_monthly?: number
          price_yearly?: number | null
          slug: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_role?: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          store_id: string | null
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          body: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          store_id?: string | null
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          store_id?: string | null
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      table_calls: {
        Row: {
          created_at: string
          id: string
          message: string | null
          reason: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          store_id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          store_id: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          store_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_calls_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          notes: string | null
          payer_name: string | null
          session_id: string
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: string
          notes?: string | null
          payer_name?: string | null
          session_id: string
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          payer_name?: string | null
          session_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      table_reservations: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          people: number
          reserved_for: string
          status: Database["public"]["Enums"]["reservation_status"]
          store_id: string
          table_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          people?: number
          reserved_for: string
          status?: Database["public"]["Enums"]["reservation_status"]
          store_id: string
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          people?: number
          reserved_for?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          store_id?: string
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_session_items: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_requested: boolean
          destination: string
          id: string
          kitchen_status: Database["public"]["Enums"]["kitchen_status"]
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          session_id: string
          store_id: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_requested?: boolean
          destination?: string
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"]
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          session_id: string
          store_id: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_requested?: boolean
          destination?: string
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"]
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          session_id?: string
          store_id?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_session_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          cash_register_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount: number
          id: string
          notes: string | null
          opened_at: string
          order_id: string | null
          paid_amount: number
          people: number
          service_fee: number
          service_fee_percent: number
          status: string
          store_id: string
          subtotal: number
          table_id: string
          total: number
          updated_at: string
          waiter_name: string | null
          waiter_user_id: string | null
        }
        Insert: {
          cash_register_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          opened_at?: string
          order_id?: string | null
          paid_amount?: number
          people?: number
          service_fee?: number
          service_fee_percent?: number
          status?: string
          store_id: string
          subtotal?: number
          table_id: string
          total?: number
          updated_at?: string
          waiter_name?: string | null
          waiter_user_id?: string | null
        }
        Update: {
          cash_register_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          opened_at?: string
          order_id?: string | null
          paid_amount?: number
          people?: number
          service_fee?: number
          service_fee_percent?: number
          status?: string
          store_id?: string
          subtotal?: number
          table_id?: string
          total?: number
          updated_at?: string
          waiter_name?: string | null
          waiter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          id: string
          name: string | null
          notes: string | null
          number: number
          position: number
          position_x: number
          position_y: number
          qr_token: string
          sector_id: string | null
          status: Database["public"]["Enums"]["table_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          number: number
          position?: number
          position_x?: number
          position_y?: number
          qr_token?: string
          sector_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          number?: number
          position?: number
          position_x?: number
          position_y?: number
          qr_token?: string
          sector_id?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_addresses: {
        Row: {
          cep: string
          city: string | null
          complement: string | null
          country: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          lng: number | null
          neighborhood: string | null
          number: string
          reference: string | null
          state: string | null
          street: string
          user_id: string
        }
        Insert: {
          cep: string
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number: string
          reference?: string | null
          state?: string | null
          street: string
          user_id: string
        }
        Update: {
          cep?: string
          city?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number?: string
          reference?: string | null
          state?: string | null
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
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          store_id: string
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          store_id: string
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          store_id?: string
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string
          store_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret: string
          store_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string
          store_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      award_order_points: { Args: { _order_id: string }; Returns: number }
      can_access_section: {
        Args: { _section: string; _store_id: string; _user_id: string }
        Returns: boolean
      }
      cash_register_expected: {
        Args: { _register_id: string }
        Returns: number
      }
      customer_points_balance: {
        Args: { _store_id: string; _user_id: string }
        Returns: number
      }
      dre_report: {
        Args: { _from: string; _store_id: string; _to: string }
        Returns: Json
      }
      generate_weekly_payouts: { Args: { _store_id: string }; Returns: number }
      get_open_cash_register: { Args: { _store_id: string }; Returns: string }
      get_store_role: {
        Args: { _store_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_listings_manager: { Args: { _uid: string }; Returns: boolean }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      master_dashboard_kpis: { Args: never; Returns: Json }
      reassign_stale_courier_orders: {
        Args: { _store_id: string }
        Returns: number
      }
      recalc_table_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      redeem_loyalty_reward: { Args: { _reward_id: string }; Returns: Json }
      register_stock_movement: {
        Args: {
          _order_id?: string
          _product_id: string
          _quantity: number
          _reason?: string
          _store_id: string
          _type: Database["public"]["Enums"]["stock_movement_type"]
          _unit_cost?: number
        }
        Returns: string
      }
      resolve_api_key: {
        Args: { _key_hash: string }
        Returns: {
          key_id: string
          store_id: string
        }[]
      }
      run_birthday_campaign: { Args: { _campaign_id: string }; Returns: number }
      run_reactivation_campaign: {
        Args: { _campaign_id: string }
        Returns: number
      }
      top_visited_listings: {
        Args: { _limit?: number }
        Returns: {
          catalog_url: string
          category_key: string
          id: string
          logo: string
          name: string
          visits: number
        }[]
      }
    }
    Enums: {
      addon_type: "single" | "multi"
      app_role: "admin" | "store_owner" | "customer" | "super_admin"
      cancel_source: "store" | "system" | "customer" | "courier"
      coupon_type: "percent" | "fixed" | "free_shipping"
      delivery_method: "delivery" | "pickup" | "logistics"
      kitchen_status:
        | "pending"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
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
      reservation_status:
        | "pending"
        | "confirmed"
        | "seated"
        | "cancelled"
        | "no_show"
      staff_role: "manager" | "attendant" | "kitchen" | "courier"
      stock_movement_type:
        | "sale"
        | "return"
        | "purchase"
        | "adjustment"
        | "loss"
        | "transfer_in"
        | "transfer_out"
      store_lifecycle: "active" | "suspended" | "blocked"
      subscription_status:
        | "trial"
        | "active"
        | "overdue"
        | "cancelled"
        | "blocked"
      table_status: "available" | "occupied" | "reserved" | "blocked"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
      app_role: ["admin", "store_owner", "customer", "super_admin"],
      cancel_source: ["store", "system", "customer", "courier"],
      coupon_type: ["percent", "fixed", "free_shipping"],
      delivery_method: ["delivery", "pickup", "logistics"],
      kitchen_status: [
        "pending",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ],
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
      reservation_status: [
        "pending",
        "confirmed",
        "seated",
        "cancelled",
        "no_show",
      ],
      staff_role: ["manager", "attendant", "kitchen", "courier"],
      stock_movement_type: [
        "sale",
        "return",
        "purchase",
        "adjustment",
        "loss",
        "transfer_in",
        "transfer_out",
      ],
      store_lifecycle: ["active", "suspended", "blocked"],
      subscription_status: [
        "trial",
        "active",
        "overdue",
        "cancelled",
        "blocked",
      ],
      table_status: ["available", "occupied", "reserved", "blocked"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
