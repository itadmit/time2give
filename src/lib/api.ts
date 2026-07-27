/**
 * עטיפות typed ל-RPC (ARCHITECTURE §11). כל כתיבה רגישה עוברת פה.
 */
import { supabase } from './supabase';
import type { Region } from './regions';
import type { RecipientType, UserRole } from './domain';

export async function setMyProfile(args: {
  full_name: string;
  photo_url?: string | null;
  roles: UserRole[];
  service_regions?: Region[];
  capabilities?: string[];
}) {
  return supabase.rpc('set_my_profile', {
    p_full_name: args.full_name,
    p_photo_url: args.photo_url ?? null,
    p_roles: args.roles,
    p_service_regions: args.service_regions ?? [],
    p_capabilities: args.capabilities ?? [],
  });
}

export async function upsertRecipientProfile(args: {
  recipient_type: RecipientType;
  region: Region;
  display_name?: string | null;
  org_id?: string | null;
}) {
  return supabase.rpc('upsert_recipient_profile', {
    p_recipient_type: args.recipient_type,
    p_region: args.region,
    p_display_name: args.display_name ?? null,
    p_org_id: args.org_id ?? null,
  });
}

export async function createNeed(args: {
  region: Region;
  food_type: string;
  quantity: number;
  unit_label?: string;
  needed_at?: string | null;
  notes?: string | null;
}) {
  return supabase.rpc('create_need', {
    p_region: args.region,
    p_food_type: args.food_type,
    p_quantity: args.quantity,
    p_unit_label: args.unit_label ?? 'מנות',
    p_needed_at: args.needed_at ?? null,
    p_notes: args.notes ?? null,
  });
}

export async function commitToNeed(need_id: string, self_transport: boolean, notes?: string) {
  return supabase.rpc('commit_to_need', {
    p_need_id: need_id,
    p_self_transport: self_transport,
    p_notes: notes ?? null,
  });
}

export async function publishOffer(args: {
  food_type: string;
  quantity: number;
  unit_label: string;
  service_regions: Region[];
  origin_city?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  kosher?: boolean;
  vegetarian?: boolean;
  notes?: string | null;
  photo_url?: string | null;
  ready_at?: string | null;
  donor_is_courier?: boolean;
}) {
  return supabase.rpc('publish_offer', {
    p_food_type: args.food_type,
    p_quantity: args.quantity,
    p_unit_label: args.unit_label,
    p_service_regions: args.service_regions,
    p_origin_city: args.origin_city ?? null,
    p_origin_lat: args.origin_lat ?? null,
    p_origin_lng: args.origin_lng ?? null,
    p_kosher: args.kosher ?? false,
    p_vegetarian: args.vegetarian ?? false,
    p_notes: args.notes ?? null,
    p_photo_url: args.photo_url ?? null,
    p_ready_at: args.ready_at ?? null,
    p_donor_is_courier: args.donor_is_courier ?? false,
  });
}

export async function claimOffer(offer_id: string, need_transport: boolean) {
  return supabase.rpc('claim_offer', { p_offer_id: offer_id, p_need_transport: need_transport });
}

export async function assignCourier(assignment_id: string, courier_id: string) {
  return supabase.rpc('assign_courier', { p_assignment_id: assignment_id, p_courier_id: courier_id });
}

/** נהג מתנדב תופס משלוח פתוח ומשבץ את עצמו (מחליף שיבוץ ידני ע"י רכז) */
export async function claimDelivery(assignment_id: string) {
  return supabase.rpc('claim_delivery', { p_assignment_id: assignment_id });
}

/** נהג מבטל משלוח שלקח → חוזר ל"ממתין לשינוע" (לפני איסוף בלבד) */
export async function releaseDelivery(assignment_id: string) {
  return supabase.rpc('release_delivery', { p_assignment_id: assignment_id });
}

/** מועמדי שינוע מדורגים לפי כיסוי אזור / זמינות / מוניטין */
export async function couriersForAssignment(assignment_id: string) {
  return supabase.rpc('couriers_for_assignment', { p_assignment_id: assignment_id });
}

export async function advanceAssignment(assignment_id: string, new_status: string) {
  return supabase.rpc('advance_assignment', {
    p_assignment_id: assignment_id,
    p_new_status: new_status,
  });
}

export async function revealPhone(assignment_id: string) {
  return supabase.rpc('reveal_phone', { p_assignment_id: assignment_id });
}

export async function adminKpis() {
  return supabase.rpc('admin_kpis');
}

export async function adminPendingUsers() {
  return supabase.rpc('admin_pending_users');
}

export async function adminApproveUser(user_id: string, approve: boolean) {
  return supabase.rpc('admin_approve_user', { p_user: user_id, p_approve: approve });
}

// ─── הגדרות אינטגרציה (WhatsApp / iBot) ───
export async function adminGetIntegrationConfig() {
  return supabase.rpc('admin_get_integration_config');
}

export async function adminSetIntegrationConfig(key: string, value: string) {
  return supabase.rpc('admin_set_integration_config', { p_key: key, p_value: value });
}

// ─── כלי בדיקות (אדמין) ───
export async function adminResetAll() {
  return supabase.rpc('admin_reset_all');
}

export async function adminListContent() {
  return supabase.rpc('admin_list_content');
}

export async function adminDeleteOffer(id: string) {
  return supabase.rpc('admin_delete_offer', { p_id: id });
}

export async function adminDeleteNeed(id: string) {
  return supabase.rpc('admin_delete_need', { p_id: id });
}

export async function adminDeleteAssignment(id: string) {
  return supabase.rpc('admin_delete_assignment', { p_id: id });
}

export async function submitRating(args: {
  assignment_id: string;
  ratee_id: string;
  score: number;
  comment?: string;
}) {
  return supabase.rpc('submit_rating', {
    p_assignment_id: args.assignment_id,
    p_ratee_id: args.ratee_id,
    p_score: args.score,
    p_comment: args.comment ?? null,
  });
}
