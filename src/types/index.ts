export type UserRole = "super_admin" | "admin" | "closer";
export type OrderStatus =
  | "nouvelle"
  | "confirmée"
  | "programmée"
  | "injoignable"
  | "faux_numéro"
  | "livrée"
  | "refusée"
  | "annulée";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
}

export interface TeamRow {
  id: string;
  name: string;
  organization_id: string;
  country: string;
  created_at: string;
}

export interface OrderRow {
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
  status: OrderStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  sheet_row_id: string | null;
  country: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string;
  active: boolean;
  country: string;
  organization_id: string | null;
  team_id: string | null;
  created_at: string;
}

export interface SheetsConfigRow {
  id: string;
  name: string;
  sheet_url: string;
  sheet_gid: string;
  last_synced: string | null;
  sync_enabled: boolean;
  column_mapping: Record<string, string>;
  country: string;
  sheet_timezone: string;
  organization_id: string | null;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  order_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface NoteEntry {
  id: string;
  order_id: string;
  user_id: string | null;
  user_name: string;
  content: string;
  created_at: string;
}

export const ORDER_STATUSES: OrderStatus[] = [
  "nouvelle",
  "confirmée",
  "programmée",
  "injoignable",
  "faux_numéro",
  "livrée",
  "refusée",
  "annulée",
];

export const FINAL_STATUSES: OrderStatus[] = ["livrée", "refusée", "annulée"];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  nouvelle: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  confirmée: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  programmée: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  injoignable: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  faux_numéro: "bg-red-500/10 text-red-500 border-red-500/20",
  livrée: "bg-green-500/10 text-green-500 border-green-500/20",
  refusée: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  annulée: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nouvelle: "Nouvelle",
  confirmée: "Confirmée",
  programmée: "Programmée",
  injoignable: "Injoignable",
  faux_numéro: "Faux numéro",
  livrée: "Livrée",
  refusée: "Refusée",
  annulée: "Annulée",
};

export interface DashboardStats {
  total: number;
  today: number;
  week: number;
  month: number;
  nouvelle: number;
  confirmée: number;
  programmée: number;
  livrée: number;
  refusée: number;
  injoignable: number;
  annulée: number;
}

export interface CloserStatsEntry {
  user_id: string;
  display_name: string;
  country: string;
  total_claimed: number;
  livree: number;
  refusee: number;
  programmee: number;
  injoignable: number;
  taux_livraison: number;
  avg_closing_time_hours: number;
}

export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_name: string;
  user_role: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}
