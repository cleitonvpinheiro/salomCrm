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
