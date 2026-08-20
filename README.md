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
- **Datos** — copia todo el recetario con instrucciones para dárselo a una IA, y
  pega su respuesta para fusionarla o reemplazarlo. Con copias de seguridad y
  deshacer.

## Los planes ("Javi come fuera", "Andrea de viaje")

En la pestaña Semana, el botón **Plan** crea cualquier evento con título libre,
rango de fechas y a quién afecta. Si marcas *comida* o *cena*, esas personas
dejan de contar: el calendario deja de pedirte que cocines para ellas y **la
lista de la compra no compra su parte**.

## Editar con una IA

En **Datos → Copiar para la IA** se copia el JSON completo junto con las reglas
del formato. Pégalo en el chat que uses y pide lo que quieras:

> planifícame la semana con recetas rápidas, que el jueves ceno fuera

Pega la respuesta y elige qué hacer con ella:

- **Fusionar** (por defecto) — añade y actualiza solo lo que venga. La IA puede
  devolver un trozo suelto, como `{"recipes": [...]}`, en vez del documento
  entero: pedirle 40 KB de JSON completo es justo lo que hace que trunque o se
  invente cosas.
- **Reemplazar** — sustituye el recetario entero.

Antes de cualquiera de las dos se guarda una copia, así que siempre hay
**Deshacer**. El JSON se valida: lo que no se entiende se descarta y te avisa, en
vez de romper la app. Acepta bloques ```` ```json ````, claves en español
(`recetas`, `personas`, `ingredientes`...) e ingredientes escritos como texto
suelto.

## Puesta en marcha

```bash
npm install
npm run dev
npm test     # tests de la fusión, que es la parte delicada
```

Sin más configuración la app ya funciona, guardando los datos en el navegador.

## En producción

- **App:** https://recetitasamorosas.vercel.app
- **Backend:** proyecto Supabase `recetario` (región `eu-west-1`).

La rama de producción es `claude/hola-8ryaj0`: cada push despliega solo.
En el móvil, *Compartir → Añadir a pantalla de inicio* la instala como app
(el manifest y los iconos ya están puestos).

Ya están configurados: el esquema y sus políticas RLS, Realtime, el registro
público **desactivado**, las URLs de redirección y las variables de entorno en
Vercel. Lo único que queda por hacer a mano es **crear las dos cuentas** (ver
abajo).

## Cómo funciona el acceso

Se entra con **nombre y contraseña**, sin email. Supabase exige un email
internamente, así que el nombre se traduce a una cuenta interna:
`Andrea` → `andrea@recetario.app`. Ese dominio no recibe correo nunca; es solo
un identificador (`emailDe()` en `src/lib/supabase.ts`).

Todo el recetario vive en **una sola fila** de la tabla `recetario`. Las
políticas RLS solo dejan leer y escribir a usuarios con sesión iniciada, y el
registro público está desactivado: solo existen las cuentas creadas a mano.

La clave `anon` del cliente es pública por diseño (va en el bundle del
navegador); la seguridad la da RLS, no ocultarla. Comprobado contra producción:
con la clave anon a secas, un `SELECT` devuelve vacío, un `INSERT` es rechazado
con `42501` y `signup` responde `signup_disabled`.

### Crear o cambiar una cuenta

En *Supabase → Authentication → Users → Add user → Create new user*:

- **Email:** el nombre en minúsculas y sin acentos, más `@recetario.app`
  (`andrea@recetario.app`, `javier@recetario.app`).
- **Password:** la que queráis.
- Marca **Auto Confirm User**, o la cuenta se queda esperando una confirmación
  por correo que nunca llegará.

Para cambiar una contraseña, en esa misma pantalla: *⋯ → Reset password*.

## Montarlo de cero en otra cuenta

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Providers → Email**: activado, y **desactiva "Allow new
   users to sign up"**.
4. **Authentication → URL Configuration**: la URL de Vercel en *Site URL* y en
   *Redirect URLs* (si no, el enlace de acceso no vuelve a la app).
5. **Authentication → Users → Add user**: crea las cuentas con Auto Confirm.
6. En Vercel, **Settings → Environment Variables** (valores en Supabase →
   *Project Settings → API*):

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

7. Vuelve a desplegar.

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
    merge.ts        fusión sin perder lo que hizo el otro (+ merge.test.ts)
    snapshots.ts    copias locales para poder deshacer
  views/          las cuatro pestañas
  components/     modales y piezas compartidas
```

Notas de implementación:

- **Escritura local primero.** Cada cambio se guarda en `localStorage` al
  instante y se sube a Supabase agrupado (600 ms), así la app responde igual sin
  cobertura y no se pierde nada al cerrar la pestaña.
- **Conflictos.** Se fusiona elemento a elemento (`src/lib/merge.ts`), no
  documento entero: si Andrea tacha la compra en el súper mientras Javi edita una
  receta, se conservan las dos cosas. Cada receta, comida y plan lleva su propio
  `updatedAt`, y lo borrado deja lápida para que no resucite al sincronizar.
  Los ajustes globales (tachados de la compra, despensa, nombres) sí son de quien
  guardó el último, porque fusionarlos por unión impediría desmarcar nada.
  Cubierto por tests: `npm test`.
- **Sobras y batch cooking.** Media olla de lentejas no existe. Al planificar una
  receta que da más raciones que comensales se puede elegir **tanda entera**: la
  compra pide los ingredientes completos y las sobras se planifican solas en los
  siguientes huecos libres, sin volver a contar en la lista.
- **Funciona sin cobertura.** `public/sw.js` precachea el HTML y los ficheros que
  este declara, así que la app abre en el súper sin señal. El HTML va
  *network-first*, para que una versión nueva entre siempre que haya red.
- **Supabase se carga con `import()` dinámico**: si no está configurado, el
  navegador no llega a descargar la librería.
- **Tipografías auto-alojadas** en `public/fonts`: sin peticiones a terceros y
  legibles aunque no haya red en el supermercado.
