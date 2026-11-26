export interface Database {
  public: {
    Tables: {
      condominiums: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          cnpj: string | null;
          city: string | null;
          state: string | null;
          units_count: number;
          plan: 'essential' | 'professional' | 'enterprise';
          subscription_status: 'trial' | 'active' | 'overdue' | 'cancelled';
          monthly_value: number;
          trial_ends_at: string | null;
          next_billing_at: string | null;
          contact_name: string | null;
          contact_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          cnpj?: string | null;
          city?: string | null;
          state?: string | null;
          units_count?: number;
          plan?: 'essential' | 'professional' | 'enterprise';
          subscription_status?: 'trial' | 'active' | 'overdue' | 'cancelled';
          monthly_value?: number;
          trial_ends_at?: string | null;
          next_billing_at?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          legal_name?: string | null;
          cnpj?: string | null;
          city?: string | null;
          state?: string | null;
          units_count?: number;
          plan?: 'essential' | 'professional' | 'enterprise';
          subscription_status?: 'trial' | 'active' | 'overdue' | 'cancelled';
          monthly_value?: number;
          trial_ends_at?: string | null;
          next_billing_at?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'general_manager' | 'admin' | 'doorman';
          condominium_id: string | null;
          created_at: string;
          status: 'active' | 'inactive';
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role: 'general_manager' | 'admin' | 'doorman';
          condominium_id?: string | null;
          created_at?: string;
          status?: 'active' | 'inactive';
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'general_manager' | 'admin' | 'doorman';
          condominium_id?: string | null;
          created_at?: string;
          status?: 'active' | 'inactive';
        };
      };
      residents: {
        Row: {
          id: string;
          name: string;
          block: string;
          apartment: string;
          whatsapp: string;
          email: string | null;
          phone: string | null;
          condominium_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          block: string;
          apartment: string;
          whatsapp: string;
          email?: string | null;
          phone?: string | null;
          condominium_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          block?: string;
          apartment?: string;
          whatsapp?: string;
          email?: string | null;
          phone?: string | null;
          condominium_id?: string;
          created_at?: string;
        };
      };
      packages: {
        Row: {
          id: string;
          resident_id: string;
          status: 'pending' | 'delivered';
          registered_by: string;
          delivered_by: string | null;
          delivered_to: string | null;
          delivered_at: string | null;
          condominium_id: string;
          created_at: string;
          whatsapp_sent: boolean;
          whatsapp_error: string | null;
          whatsapp_sent_at: string | null;
          whatsapp_message_id: string | null;
          notification_status: 'pending' | 'opened' | 'sent' | 'failed';
          email_delivery_status: 'pending' | 'sent' | 'failed';
          email_last_sent_at: string | null;
        };
        Insert: {
          id?: string;
          resident_id: string;
          status?: 'pending' | 'delivered';
          registered_by: string;
          delivered_by?: string | null;
          delivered_to?: string | null;
          delivered_at?: string | null;
          condominium_id: string;
          created_at?: string;
          whatsapp_sent?: boolean;
          whatsapp_error?: string | null;
          whatsapp_sent_at?: string | null;
          whatsapp_message_id?: string | null;
          notification_status?: 'pending' | 'opened' | 'sent' | 'failed';
          email_delivery_status?: 'pending' | 'sent' | 'failed';
          email_last_sent_at?: string | null;
        };
        Update: {
          id?: string;
          resident_id?: string;
          status?: 'pending' | 'delivered';
          registered_by?: string;
          delivered_by?: string | null;
          delivered_to?: string | null;
          delivered_at?: string | null;
          condominium_id?: string;
          created_at?: string;
          whatsapp_sent?: boolean;
          whatsapp_error?: string | null;
          whatsapp_sent_at?: string | null;
          whatsapp_message_id?: string | null;
          notification_status?: 'pending' | 'opened' | 'sent' | 'failed';
          email_delivery_status?: 'pending' | 'sent' | 'failed';
          email_last_sent_at?: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          action: string;
          profile_id: string;
          package_id: string | null;
          condominium_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          profile_id: string;
          package_id?: string | null;
          condominium_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          action?: string;
          profile_id?: string;
          package_id?: string | null;
          condominium_id?: string;
          created_at?: string;
        };
      };
      password_reset_requests: {
        Row: {
          id: string;
          profile_id: string;
          email: string;
          condominium_id: string;
          status: 'pending' | 'resolved' | 'cancelled';
          requested_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          email: string;
          condominium_id: string;
          status?: 'pending' | 'resolved' | 'cancelled';
          requested_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          email?: string;
          condominium_id?: string;
          status?: 'pending' | 'resolved' | 'cancelled';
          requested_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
      };
    };
  };
}

export type Condominium = Database['public']['Tables']['condominiums']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Resident = Database['public']['Tables']['residents']['Row'];
export type Package = Database['public']['Tables']['packages']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type PasswordResetRequest = Database['public']['Tables']['password_reset_requests']['Row'];

export type PackageWithResident = Package & {
  resident: Resident;
};

export type AdminPackage = Package & {
  resident: Pick<Resident, 'id' | 'name' | 'block' | 'apartment' | 'whatsapp'> | null;
  doorman: Pick<Profile, 'id' | 'name' | 'email'> | null;
  delivered_by_profile: Pick<Profile, 'id' | 'name' | 'email'> | null;
};

export type PasswordResetRequestWithProfile = PasswordResetRequest & {
  requester: Pick<Profile, 'id' | 'name' | 'email' | 'role' | 'status'> | null;
  resolver: Pick<Profile, 'id' | 'name' | 'email'> | null;
};
