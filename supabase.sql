-- Bristol F.C. · tabla de la demo (pegar en Supabase → SQL Editor → Run)
create table if not exists public.estado (
  id         int primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.estado enable row level security;

-- DEMO: la clave pública (rol "anon") puede leer y escribir esta única tabla.
-- Solo para datos ficticios. En producción: login real con Supabase Auth y políticas por rol.
drop policy if exists demo_select on public.estado;
drop policy if exists demo_insert on public.estado;
drop policy if exists demo_update on public.estado;
create policy demo_select on public.estado for select to anon using (true);
create policy demo_insert on public.estado for insert to anon with check (true);
create policy demo_update on public.estado for update to anon using (true) with check (true);
