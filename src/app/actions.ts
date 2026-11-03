'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser, ownerUser } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import {
  projectSchema,
  shareSchema,
  conversationSchema,
  connectionSchema,
  employeeSchema,
  workspaceSchema,
  accountSchema,
  inviteSchema,
  uuid,
} from '@/lib/schemas';
import { AppError, dbError, publicError } from '@/lib/errors';
import { encryptSecret } from '@/lib/crypto';
import { rateLimit } from '@/lib/http';
import { appOrigin } from '@/lib/env';
import { projectData } from '@/lib/data';
import type { ActionResult } from '@/lib/types';

async function result(task: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await task();
  } catch (e) {
    return { error: publicError(e).message };
  }
}
export async function createProject(input: unknown) {
  return result(async () => {
    const data = projectSchema.parse(input),
      { db, member } = await currentUser();
    await rateLimit(`write:${member.user_id}`, 60);
    const { data: p, error } = await db
      .from('projects')
      .insert({ ...data, workspace_id: member.workspace_id, created_by: member.user_id })
      .select('id')
      .single();
    dbError(error);
    revalidatePath('/projects');
    revalidatePath('/overview');
    return { ok: true, id: p!.id };
  });
}
export async function updateProject(id: string, input: unknown) {
  return result(async () => {
    uuid.parse(id);
    const data = projectSchema.parse(input),
      { db } = await currentUser();
    const p = await projectData(id);
    if (!p.canManage) throw new AppError('FORBIDDEN', 'Chỉ chủ dự án được chỉnh sửa.', 403);
    const { error } = await db
      .from('projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    dbError(error);
    revalidatePath('/projects');
    return { ok: true };
  });
}
export async function archiveProject(id: string, archived: boolean) {
  return result(async () => {
    uuid.parse(id);
    z.boolean().parse(archived);
    const { db } = await currentUser();
    const p = await projectData(id);
    if (!p.canManage) throw new AppError('FORBIDDEN', 'Chỉ chủ dự án được lưu trữ.', 403);
    const { error } = await db
      .from('projects')
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    dbError(error);
    revalidatePath('/projects');
    revalidatePath('/overview');
    return { ok: true };
  });
}
export async function shareProject(input: unknown) {
  return result(async () => {
    const d = shareSchema.parse(input),
      { db } = await currentUser();
    const p = await projectData(d.project_id);
    if (!p.canManage || d.user_id === p.project.created_by)
      throw new AppError('FORBIDDEN', 'Không thể thay đổi quyền này.', 403);
    const q =
      d.permission === 'remove'
        ? db
            .from('project_members')
            .delete()
            .eq('project_id', d.project_id)
            .eq('user_id', d.user_id)
        : db.from('project_members').upsert(d);
    const { error } = await q;
    dbError(error);
    revalidatePath('/projects/' + d.project_id);
    return { ok: true };
  });
}
export async function createConversation(input: unknown) {
  return result(async () => {
    const d = conversationSchema.parse(input),
      { db, member } = await currentUser();
    await rateLimit(`conversation:${member.user_id}`, 30);
    const { data, error } = await db.rpc('create_conversation', {
      p_project: d.project_id,
      p_title: d.title,
      p_connection: d.connection_id,
      p_parent: d.parent_id || null,
    });
    dbError(error);
    revalidatePath('/projects/' + d.project_id);
    return { ok: true, id: data };
  });
}
export async function saveConnection(input: unknown) {
  return result(async () => {
    const d = connectionSchema.parse(input),
      { member, sessionId } = await ownerUser();
    const id = d.id || crypto.randomUUID();
    const { api_key, ...metadata } = d;
    const { error } = await adminClient().rpc('save_connection', {
      p_actor: member.user_id,
      p_session: sessionId,
      p_data: { ...metadata, id },
      p_ciphertext: api_key ? encryptSecret(api_key, id) : null,
    });
    dbError(error);
    revalidatePath('/integrations');
    return { ok: true, id };
  });
}
export async function saveAccount(input: unknown) {
  return result(async () => {
    const d = accountSchema.parse(input),
      { db, member } = await ownerUser();
    const { error } = await db
      .from('provider_accounts')
      .upsert({ ...d, workspace_id: member.workspace_id }, { onConflict: 'workspace_id,provider' });
    dbError(error);
    revalidatePath('/integrations');
    return { ok: true };
  });
}
export async function saveEmployee(input: unknown) {
  return result(async () => {
    const d = employeeSchema.parse(input),
      { member, sessionId } = await ownerUser();
    const { error } = await adminClient().rpc('update_employee', {
      p_actor: member.user_id,
      p_session: sessionId,
      p_user: d.user_id,
      p_status: d.status,
      p_limit: d.monthly_limit,
    });
    dbError(error);
    revalidatePath('/team');
    return { ok: true };
  });
}
export async function inviteEmployee(input: unknown) {
  return result(async () => {
    const d = inviteSchema.parse(input),
      { member, db } = await ownerUser();
    await rateLimit(`invite:${member.user_id}`, 10, 3600);
    const { data: existing, error: lookupError } = await db
      .from('members')
      .select('user_id')
      .eq('email', d.email.toLowerCase())
      .maybeSingle();
    dbError(lookupError);
    if (existing) throw new AppError('CONFLICT', 'Email này đã có trong workspace.', 409);
    const admin = adminClient();
    const invited = await admin.auth.admin.inviteUserByEmail(d.email, {
      redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
      data: { display_name: d.display_name },
    });
    if (invited.error || !invited.data.user)
      throw new AppError(
        'INVITE_FAILED',
        'Không thể gửi lời mời. Kiểm tra email và cấu hình SMTP trong Supabase.',
        400,
      );
    const { error } = await admin.from('members').insert({
      user_id: invited.data.user.id,
      workspace_id: member.workspace_id,
      email: d.email.toLowerCase(),
      display_name: d.display_name,
      role: 'employee',
      monthly_limit: 0,
    });
    if (error)
      throw new AppError(
        'PROVISIONING_FAILED',
        'Email mời đã được tạo nhưng chưa cấp được workspace. Cần kiểm tra provisioning trước khi gửi lại.',
        503,
      );
    await admin.from('audit_events').insert({
      workspace_id: member.workspace_id,
      actor_id: member.user_id,
      action: 'employee.invite',
      resource_id: invited.data.user.id,
    });
    revalidatePath('/team');
    return {
      ok: true,
      message: 'Đã gửi lời mời. Cấp nguồn AI và hạn mức trước khi nhân viên chat.',
    };
  });
}
export async function saveWorkspace(input: unknown) {
  return result(async () => {
    const d = workspaceSchema.parse(input),
      { db, member } = await ownerUser();
    const { error } = await db.from('workspaces').update(d).eq('id', member.workspace_id);
    dbError(error);
    revalidatePath('/settings');
    revalidatePath('/usage');
    revalidatePath('/overview');
    return { ok: true };
  });
}
export async function saveProfile(input: unknown) {
  return result(async () => {
    const d = z.object({ display_name: z.string().trim().min(1).max(100) }).parse(input),
      { db, member } = await currentUser();
    const { error } = await db.from('members').update(d).eq('user_id', member.user_id);
    dbError(error);
    revalidatePath('/', 'layout');
    return { ok: true };
  });
}
export async function reconcileRun(input: unknown) {
  return result(async () => {
    const d = z
        .object({ id: uuid, actual_cost: z.coerce.number().min(0).max(100000) })
        .parse(input),
      { member, sessionId } = await ownerUser();
    const { error } = await adminClient().rpc('reconcile_run', {
      p_actor: member.user_id,
      p_session: sessionId,
      p_run: d.id,
      p_actual: d.actual_cost,
    });
    dbError(error);
    revalidatePath('/usage');
    return { ok: true };
  });
}
