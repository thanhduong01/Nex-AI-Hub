import { currentUser } from '@/lib/auth';
import { projectData } from '@/lib/data';
import { adminClient } from '@/lib/supabase/admin';
import { uuid } from '@/lib/schemas';
import { AppError, dbError } from '@/lib/errors';
import { checkOrigin, failure, json, rateLimit } from '@/lib/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { member, db } = await currentUser();
    await rateLimit(`upload:${member.user_id}`, 20, 3600);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError('BAD_REQUEST', 'Thiếu tệp.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3200000) {
        await reader.cancel();
        throw new AppError('TOO_LARGE', 'Tệp tối đa 3 MB.', 413);
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type') || '' },
    }).formData();
    const projectId = uuid.parse(form.get('project_id')),
      p = await projectData(projectId);
    if (!p.canWrite)
      throw new AppError('FORBIDDEN', 'Bạn cần quyền đóng góp để tải tài liệu.', 403);
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 3000000 || !file.size)
      throw new AppError('INVALID_FILE', 'Chọn tệp có nội dung, tối đa 3 MB.');
    const name = file.name
        .normalize('NFC')
        .replace(/[\x00-\x1f/\\]/g, '_')
        .slice(0, 180),
      ext = name.split('.').pop()?.toLowerCase();
    const mimes: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      pdf: 'application/pdf',
      csv: 'text/csv',
      json: 'application/json',
    };
    const mime = ext ? mimes[ext] : null;
    if (!mime) throw new AppError('INVALID_FILE', 'Hỗ trợ TXT, Markdown, PDF, CSV và JSON.');
    const bytes = Buffer.from(await file.arrayBuffer());
    let textContent: string | null = null;
    if (ext === 'pdf') {
      if (bytes.subarray(0, 5).toString() !== '%PDF-')
        throw new AppError('INVALID_FILE', 'Tệp PDF không hợp lệ.');
    } else {
      try {
        const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (t.includes('\0')) throw new Error('binary');
        if (bytes.length <= 120000) textContent = t;
      } catch {
        throw new AppError('INVALID_FILE', 'Tệp văn bản phải dùng UTF-8.');
      }
    }
    const id = crypto.randomUUID(),
      path = `${projectId}/${id}/${name}`,
      admin = adminClient();
    const upload = await admin.storage
      .from('project-files')
      .upload(path, bytes, { contentType: mime, upsert: false });
    dbError(upload.error);
    // Recheck current permissions after upload, before attaching metadata.
    const again = await projectData(projectId);
    if (!again.canWrite) {
      await admin.storage.from('project-files').remove([path]);
      throw new AppError('FORBIDDEN', 'Quyền truy cập đã thay đổi.', 403);
    }
    const insert = await db.from('documents').insert({
      id,
      project_id: projectId,
      uploaded_by: member.user_id,
      name,
      storage_path: path,
      mime_type: mime,
      size_bytes: file.size,
      text_content: textContent,
    });
    if (insert.error) {
      await admin.storage.from('project-files').remove([path]);
      dbError(insert.error);
    }
    return json({ ok: true, id });
  } catch (e) {
    return failure(e);
  }
}
