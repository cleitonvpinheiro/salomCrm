// Hand-written mirrors of the Pydantic models in backend/models/salon.py —
// nothing infers across the HTTP boundary, keep the two in sync in the same edit.

export interface Stylist {
  id: string;
  name: string;
  title: string;
  color: string;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  client_count: number;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  stylist_id: string | null;
  hair_type: string | null;
  last_visit: string | null;
  formula: string | null;
  tags: string[];
  created_at: string;
  stylist_name: string | null;
  stylist_color: string | null;
  days_since_visit: number | null;
  note_count: number;
}

export type NoteKind = "visit" | "formula" | "allergy" | "general";

export interface Note {
  id: string;
  client_id: string;
  kind: NoteKind;
  body: string;
  created_at: string;
}

export interface Stats {
  today: string;
  total_clients: number;
  active_stylists: number;
  visits_this_month: number;
  recall_due: number;
  unassigned: number;
}

// ---- Services (mirrors backend Service / ServiceCreate / ServiceUpdate) ----

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  active: boolean;
  created_at: string;
}

// ---- Appointments (mirrors backend AppointmentRead) ----

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  client_id: string;
  stylist_id: string | null;
  service_id: string;
  date: string;
  time: string;
  notes: string | null;
  status: AppointmentStatus;
  created_at: string;
  created_by: string;
  client_name: string | null;
  stylist_name: string | null;
  service_name: string | null;
  service_price: number;
  service_duration_min: number;
}
