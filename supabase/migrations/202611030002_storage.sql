-- Files are read/written only through authenticated Hub handlers using service_role.
-- No authenticated/anonymous storage.objects policy exposes the private bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('project-files','project-files',false,3000000,array['text/plain','text/markdown','application/pdf','text/csv','application/json'])
on conflict(id) do nothing;
