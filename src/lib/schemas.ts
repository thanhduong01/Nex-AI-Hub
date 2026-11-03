import { z } from 'zod';
export const uuid = z.string().uuid('ID không hợp lệ.');
export const email = z.string().trim().email('Email không hợp lệ.').max(254);
export const password = z.string().min(12, 'Mật khẩu cần ít nhất 12 ký tự.').max(128);
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Nhập mật khẩu.').max(128),
});
export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên dự án.').max(100),
  description: z.string().trim().max(1000).default(''),
  category: z.string().trim().min(1).max(50).default('Nghiên cứu'),
});
export const shareSchema = z.object({
  project_id: uuid,
  user_id: uuid,
  permission: z.enum(['viewer', 'contributor', 'remove']),
});
export const conversationSchema = z.object({
  project_id: uuid,
  connection_id: uuid,
  title: z.string().trim().min(1).max(200),
  parent_id: uuid.optional(),
});
export const chatSchema = z.object({
  conversation_id: uuid,
  request_id: uuid,
  content: z.string().trim().min(1, 'Nhập câu hỏi.').max(20000, 'Câu hỏi quá dài.'),
  document_ids: z.array(uuid).max(5).default([]),
});
export const connectionSchema = z.object({
  id: uuid.optional(),
  provider: z.enum(['openai', 'anthropic', 'google']),
  name: z.string().trim().min(1).max(100),
  model: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._:/-]{1,120}$/, 'Tên model không hợp lệ.'),
  api_key: z.string().trim().min(10).max(500).optional(),
  enabled: z.boolean(),
  input_price: z.coerce.number().min(0).max(10000),
  output_price: z.coerce.number().min(0).max(10000),
  max_output_tokens: z.coerce.number().int().min(128).max(8192),
  grants: z.array(uuid).max(100),
});
export const accountSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'meta']),
  label: z.string().trim().min(1).max(100),
  plan: z.string().trim().max(100),
  renewal_date: z.string().date().nullable(),
  notes: z.string().trim().max(1000),
});
export const employeeSchema = z.object({
  user_id: uuid,
  status: z.enum(['active', 'suspended']),
  monthly_limit: z.coerce.number().min(0).max(100000),
});
export const inviteSchema = z.object({ email, display_name: z.string().trim().min(1).max(100) });
export const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  monthly_budget: z.coerce.number().min(0).max(1000000),
  warning_percent: z.coerce.number().int().min(1).max(99),
});
export const importMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000),
  created_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export const importItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  source: z.enum(['openai', 'anthropic', 'google', 'meta', 'normalized']),
  source_id: z.string().max(200).nullable(),
  messages: z.array(importMessageSchema).min(1).max(500),
});
export const importSchema = z.object({
  project_id: uuid,
  items: z.array(importItemSchema).min(1).max(50),
});
export type ImportItem = z.infer<typeof importItemSchema>;
