-- Supabase grants these by default; RLS is what actually restricts rows.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
