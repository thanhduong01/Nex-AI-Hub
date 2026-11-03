import { z } from 'zod';
import { importItemSchema, type ImportItem } from './schemas';
const record = z.record(z.string(), z.unknown());
function object(value: unknown) {
  return record.parse(value);
}
function date(value: unknown) {
  const n =
    typeof value === 'number' ? value * 1000 : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}
export interface ImportPreview {
  items: ImportItem[];
  warnings: string[];
}
export function parseImport(input: unknown): ImportPreview {
  const warnings: string[] = [];
  let items: ImportItem[] = [];
  if (!Array.isArray(input)) {
    const obj = object(input);
    if (obj.format !== 'nex-ai-hub-v1' || !Array.isArray(obj.conversations))
      throw new Error(
        'Định dạng chưa hỗ trợ. Dùng JSON export ChatGPT/Claude hoặc định dạng Nex AI Hub v1.',
      );
    items = obj.conversations.map((item) => importItemSchema.parse(item));
  } else {
    if (input.length > 50) throw new Error('Mỗi lần nhập tối đa 50 hội thoại. Hãy chia nhỏ tệp.');
    for (const raw of input) {
      const row = object(raw);
      if (row.mapping) {
        const map = object(row.mapping);
        let cursor = text(row.current_node);
        if (!cursor) {
          const leaves = Object.entries(map).filter(([, v]) => {
            const node = object(v);
            return !Array.isArray(node.children) || !node.children.length;
          });
          cursor =
            leaves.sort(
              (a, b) =>
                Number(object(object(b[1]).message || {}).create_time || 0) -
                Number(object(object(a[1]).message || {}).create_time || 0),
            )[0]?.[0] || '';
          warnings.push('Một export không có current_node; chọn nhánh kết thúc mới nhất.');
        }
        const visited = new Set<string>();
        const branch: Record<string, unknown>[] = [];
        while (cursor) {
          if (visited.has(cursor) || visited.size >= 500)
            throw new Error('Cây hội thoại lỗi hoặc vượt quá 500 tin nhắn.');
          visited.add(cursor);
          const node = object(map[cursor]);
          if (node.message) branch.unshift(object(node.message));
          cursor = text(node.parent);
        }
        const messages: ImportItem['messages'] = [];
        for (const m of branch) {
          const role = object(m.author || {}).role,
            content = object(m.content || {});
          if (!['user', 'assistant', 'system'].includes(text(role))) continue;
          const parts = Array.isArray(content.parts) ? content.parts : [];
          if (parts.some((p) => typeof p !== 'string'))
            warnings.push('Bỏ qua ảnh/tệp đính kèm: bản nhập này chỉ giữ văn bản.');
          const body = parts
            .filter((p) => typeof p === 'string')
            .join('\n')
            .trim();
          if (body)
            messages.push({
              role: role as 'user' | 'assistant' | 'system',
              content: body,
              created_at: date(m.create_time),
            });
        }
        if (messages.length)
          items.push(
            importItemSchema.parse({
              title: text(row.title) || 'Hội thoại ChatGPT',
              source: 'openai',
              source_id: text(row.id) || null,
              messages,
            }),
          );
      } else if (Array.isArray(row.chat_messages)) {
        const messages: ImportItem['messages'] = [];
        for (const rawMessage of row.chat_messages) {
          const m = object(rawMessage);
          let body = text(m.text);
          if (!body && Array.isArray(m.content))
            body = m.content
              .map((c) => {
                const part = object(c);
                return part.type === 'text' ? text(part.text) : '';
              })
              .filter(Boolean)
              .join('\n');
          if (Array.isArray(m.attachments) && m.attachments.length)
            warnings.push('Export Claude có tệp đính kèm; nội dung tệp chưa được nhập.');
          const role =
            m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : null;
          if (role && body.trim())
            messages.push({ role, content: body, created_at: date(m.created_at) });
        }
        if (messages.length)
          items.push(
            importItemSchema.parse({
              title: text(row.name) || 'Hội thoại Claude',
              source: 'anthropic',
              source_id: text(row.uuid) || null,
              messages,
            }),
          );
      } else
        throw new Error(
          'Không nhận diện được export. Gemini/Meta cần chuyển sang định dạng Nex AI Hub v1.',
        );
    }
  }
  if (!items.length || items.length > 50)
    throw new Error('Tệp cần có từ 1 đến 50 hội thoại văn bản.');
  if (JSON.stringify(items).length > 750000)
    throw new Error('Dữ liệu quá lớn; chia nhỏ tệp trước khi nhập.');
  warnings.push(
    'Tác giả nội dung gốc được giữ là chưa xác định. Người nhập không được gán thành tác giả.',
  );
  return { items, warnings: [...new Set(warnings)] };
}
