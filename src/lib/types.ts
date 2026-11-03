export type Provider = 'openai' | 'anthropic' | 'google';
export type Source = Provider | 'meta' | 'hub' | 'normalized';
export interface Member {
  user_id: string;
  workspace_id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'employee';
  status: 'active' | 'suspended';
  monthly_limit: number;
  created_at: string;
}
export interface Workspace {
  id: string;
  name: string;
  monthly_budget: number;
  warning_percent: number;
}
export interface Project {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  category: string;
  archived_at: string | null;
  updated_at: string;
  created_at: string;
}
export interface ProjectMember {
  project_id: string;
  user_id: string;
  permission: 'viewer' | 'contributor';
}
export interface Connection {
  id: string;
  workspace_id: string;
  provider: Provider;
  name: string;
  model: string;
  enabled: boolean;
  input_price: number;
  output_price: number;
  max_output_tokens: number;
  updated_at: string;
}
export interface ProviderAccount {
  id: string;
  provider: Provider | 'meta';
  label: string;
  plan: string;
  renewal_date: string | null;
  notes: string;
}
export interface Conversation {
  id: string;
  project_id: string;
  created_by: string | null;
  title: string;
  connection_id: string | null;
  model: string | null;
  source: Source;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface Message {
  id: string;
  sequence: number;
  conversation_id: string;
  run_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  author_id: string | null;
  status: 'complete' | 'streaming' | 'partial' | 'failed';
  created_at: string;
}
export interface Run {
  max_output_tokens: number;
  id: string;
  request_id: string;
  conversation_id: string;
  actor_id: string;
  connection_id: string;
  model: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  reserved_cost: number;
  actual_cost: number | null;
  usage_state: 'pending' | 'recorded' | 'reconciled';
  input_tokens: number | null;
  output_tokens: number | null;
  error_code: string | null;
  heartbeat_at: string;
  created_at: string;
}
export interface DocumentRecord {
  id: string;
  project_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  text_content?: string | null;
  storage_path?: string;
  created_at: string;
}
export interface Usage {
  recorded: number;
  reserved: number;
  runs: number;
  pending: number;
}
export interface ActionResult {
  ok?: boolean;
  error?: string;
  id?: string;
  message?: string;
}
export const PROVIDERS: Record<
  Provider | 'meta',
  { name: string; letter: string; className: string }
> = {
  openai: { name: 'OpenAI', letter: 'O', className: 'openai' },
  anthropic: { name: 'Claude', letter: 'C', className: 'anthropic' },
  google: { name: 'Gemini', letter: 'G', className: 'google' },
  meta: { name: 'Meta AI', letter: 'M', className: 'meta' },
};
