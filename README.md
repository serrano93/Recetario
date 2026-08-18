# Recetario

Web app de recetas, menús de la semana y lista de la compra para dos personas
con horarios flexibles.

- **Comidas** — el repertorio: todo lo que se puede comer o cenar, buscable por
  nombre, etiqueta o ingrediente. Aquí se escriben y editan las recetas.
- **Semana** — calendario rodante de 7 días **desde hoy** (no de lunes a
  domingo). Cada día tiene comida y cena, y cada hueco admite una comida
  compartida o una distinta para cada uno.
- **Compra** — se calcula sola a partir de lo planificado: suma cantidades,
  las escala según cuánta gente coma y descuenta lo que ya hay en la despensa.
- **Datos** — copia todo el recetario con instrucciones para dárselo a una IA,
  y pega la respuesta para sobrescribirlo.

## Los planes ("Javi come fuera", "Andrea de viaje")

En la pestaña Semana, el botón **Plan** crea cualquier evento con título libre,
rango de fechas y a quién afecta. Si marcas *comida* o *cena*, esas personas
dejan de contar: el calendario deja de pedirte que cocines para ellas y **la
lista de la compra no compra su parte**.

## Editar con una IA

En **Datos → Copiar para la IA** se copia el JSON completo junto con las reglas
del formato. Pégalo en el chat que uses y pide lo que quieras:

> planifícame la semana con recetas rápidas, que el jueves ceno fuera

Pega la respuesta en *Pegar y sobrescribir*. El JSON se valida antes de
cargarse: lo que no se entiende se descarta y te avisa, en vez de romper la app.
Acepta bloques ```` ```json ````, claves en español (`recetas`, `personas`,
`ingredientes`...) e ingredientes escritos como texto suelto.

## Puesta en marcha

```bash
npm install
npm run dev
```

Sin más configuración la app ya funciona, guardando los datos en el navegador.

## Desplegar en Vercel

1. Entra en [vercel.com/new](https://vercel.com/new) e importa este repositorio.
2. Vercel detecta Vite solo; `vercel.json` ya fija build y directorio de salida.
3. Deploy. Ya tienes la URL.

En el móvil, *Compartir → Añadir a pantalla de inicio* la instala como app
(el manifest y los iconos ya están puestos).

## Compartir los datos entre los dos (Supabase)

Sin esto, cada móvil tiene su propia copia. Con esto, los dos veis lo mismo al
instante.

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Providers → Email**: deja activado *Email*, y **desactiva
   "Allow new users to sign up"**. Así solo entra quien tú invites.
4. **Authentication → Users → Invite user**: invita vuestros dos correos.
5. **Authentication → URL Configuration**: añade la URL de Vercel a *Site URL* y
   a *Redirect URLs* (si no, el enlace de acceso no vuelve a la app).
6. En Vercel, **Settings → Environment Variables**:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

   Los dos valores están en Supabase → *Project Settings → API*. La clave `anon`
   es pública por diseño: quien manda es la política RLS del `schema.sql`, que
   solo deja entrar a usuarios con sesión.
7. Vuelve a desplegar. Al abrir la app pedirá el email y mandará un enlace de
   acceso; se entra una vez y el móvil queda recordado.

Para desarrollo local, los mismos valores en un `.env.local`.

## Cómo está montado

Todo el estado es un único objeto JSON (`AppData` en `src/types.ts`). Es una
decisión deliberada: los datos son pequeños, siempre se leen enteros, y así
"exportar para la IA" es exactamente lo mismo que hay en la base de datos.
En Supabase vive en **una sola fila** de la tabla `recetario`.

```
src/
  types.ts        modelo de datos (el contrato con la IA)
  store.tsx       estado, guardado local y sincronización
  lib/
    dates.ts        fechas en local, sin librerías
    ingredients.ts  parseo, escalado y suma de la compra
    plan.ts         quién come en casa cada día
    validate.ts     saneado de JSON de fuera; nunca lanza
    aiPrompt.ts     instrucciones que acompañan al export
    supabase.ts     sincronización opcional (carga perezosa)
  views/          las cuatro pestañas
  components/     modales y piezas compartidas
```

Notas de implementación:

- **Escritura local primero.** Cada cambio se guarda en `localStorage` al
  instante y se sube a Supabase agrupado (600 ms), así la app responde igual sin
  cobertura y no se pierde nada al cerrar la pestaña.
- **Conflictos.** Gana la copia con `updatedAt` más reciente. Para dos personas
  es suficiente y evita fusiones raras a medias.
- **Supabase se carga con `import()` dinámico**: si no está configurado, el
  navegador no llega a descargar la librería.
- **Tipografías auto-alojadas** en `public/fonts`: sin peticiones a terceros y
  legibles aunque no haya red en el supermercado.
