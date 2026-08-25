-- Esquema del Recetario.
--
-- Todo el estado vive en una unica fila JSONB compartida por las dos personas.
-- Es deliberado: los datos son pequenos, siempre se leen enteros y asi el
-- export/import para editar con una IA es exactamente lo mismo que hay en la
-- base de datos.
--
-- Ejecuta este fichero en Supabase → SQL Editor.

create table if not exists public.recetario (
  id         text primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.recetario enable row level security;

-- Solo personas con sesion iniciada. La app usa enlace magico por email, asi
-- que basta con invitar a los dos correos desde Authentication → Users.
drop policy if exists "recetario lectura" on public.recetario;
create policy "recetario lectura"
  on public.recetario for select
  to authenticated
  using (true);

drop policy if exists "recetario alta" on public.recetario;
create policy "recetario alta"
  on public.recetario for insert
  to authenticated
  with check (true);

drop policy if exists "recetario cambios" on public.recetario;
create policy "recetario cambios"
  on public.recetario for update
  to authenticated
  using (true)
  with check (true);

-- Realtime: hace que el movil de uno se entere de los cambios del otro.
-- El bloque evita el error si la tabla ya estaba publicada.
do $$
begin
  alter publication supabase_realtime add table public.recetario;
exception
  when duplicate_object then null;
end
$$;

-- Fila inicial vacia (la app la rellena en el primer guardado).
insert into public.recetario (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Integraciones (Google Calendar)
--
-- Los tokens de Google NO pueden vivir en la tabla `recetario`: ese documento
-- se le sirve entero al navegador. Aqui van aparte y, a proposito, SIN ninguna
-- policy: con RLS activado y cero policies, la clave `anon` no puede leer ni
-- una fila. Solo entra `service_role`, que se salta RLS y solo existe en las
-- variables de entorno del servidor.
-- ---------------------------------------------------------------------------

create table if not exists public.integraciones (
  person_id     text primary key,
  proveedor     text        not null default 'google',
  refresh_token text        not null,
  -- Calendario "Recetario" que crea la app para publicar las comidas.
  calendar_id   text,
  actualizado   timestamptz not null default now()
);

alter table public.integraciones enable row level security;
