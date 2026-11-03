import 'server-only';
import { currentUser } from './auth';
import { AppError, dbError } from './errors';
import type {
  Project,
  Connection,
  ProjectMember,
  Conversation,
  Message,
  DocumentRecord,
  Workspace,
  Usage,
} from './types';
export async function workspaceData() {
  const { db, member } = await currentUser();
  const [{ data: workspace, error: a }, { data: usage, error: b }] = await Promise.all([
    db
      .from('workspaces')
      .select('id,name,monthly_budget,warning_percent')
      .eq('id', member.workspace_id)
      .single(),
    db.rpc('usage_summary'),
  ]);
  dbError(a);
  dbError(b);
  return { workspace: workspace as Workspace, usage: usage as Usage };
}
export async function projectsData(includeArchived = false) {
  const { db } = await currentUser();
  let query = db.from('projects').select('*').order('updated_at', { ascending: false }).limit(100);
  if (!includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  dbError(error);
  return data as Project[];
}
export async function projectData(id: string) {
  const { db, member } = await currentUser();
  const [{ data: project, error: a }, { data: members, error: b }] = await Promise.all([
    db.from('projects').select('*').eq('id', id).maybeSingle(),
    db.from('project_members').select('*').eq('project_id', id),
  ]);
  dbError(a);
  dbError(b);
  if (!project)
    throw new AppError('NOT_FOUND', 'Không tìm thấy dự án hoặc bạn chưa được cấp quyền.', 404);
  const shares = members as ProjectMember[];
  return {
    project: project as Project,
    members: shares,
    canManage: project.created_by === member.user_id,
    canWrite:
      !project.archived_at &&
      (project.created_by === member.user_id ||
        shares.some((m) => m.user_id === member.user_id && m.permission === 'contributor')),
  };
}
export async function connectionsData() {
  const { db } = await currentUser();
  const { data, error } = await db.from('connections').select('*').order('created_at');
  dbError(error);
  return data as Connection[];
}
export async function conversationData(id: string) {
  const { db } = await currentUser();
  const { data, error } = await db.from('conversations').select('*').eq('id', id).maybeSingle();
  dbError(error);
  if (!data)
    throw new AppError('NOT_FOUND', 'Không tìm thấy hội thoại hoặc bạn chưa được cấp quyền.', 404);
  const [{ data: messages, error: a }, p] = await Promise.all([
    db
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('sequence', { ascending: false })
      .limit(200),
    projectData(data.project_id),
  ]);
  dbError(a);
  return { conversation: data as Conversation, messages: (messages as Message[]).reverse(), ...p };
}
export async function documentsData(projectId: string) {
  const { db } = await currentUser();
  const { data, error } = await db
    .from('documents')
    .select('id,project_id,name,size_bytes,mime_type,created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100);
  dbError(error);
  return data as DocumentRecord[];
}
