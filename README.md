# Recetario

Web app de recetas, menús de la semana y lista de la compra para dos personas
con horarios flexibles.

- **Comidas** — el repertorio: todo lo que se puede comer o cenar, buscable por
  nombre, etiqueta o ingrediente. Aquí se escriben y editan las recetas, y está
  el **constructor** que calcula cantidades y calorías por ti.
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

## Valoraciones

En la ficha de cada receta, **Javi y Andrea puntúan por separado** de 0,5 a 5
estrellas. Cada estrella tiene dos mitades: la izquierda pone media y la derecha
entera. Tocar el valor que ya está puesto lo quita.

Se guardan por persona a propósito. Que a uno le encanten las lentejas y al otro
no es información útil, y promediarla a 3 la perdería: la media solo se usa para
enseñarla en la lista y para que las mejor valoradas suban al principio.

**Quitar una valoración guarda un 0, no borra la clave.** Al fusionar con el otro
móvil, una clave que falta se rellena con lo que tuviera el otro lado — así que
borrarla sin más haría que la valoración volviera sola en la siguiente
sincronización. Las valoraciones también se unen persona a persona al fusionar
(`src/lib/merge.ts`), para que valorar los dos a la vez no pise una de las dos.

## El constructor de recetas

El botón del gorro de cocinero (encima del **+**, en Comidas) abre un asistente:
eliges proteína, verduras e hidratos, cómo lo vas a cocinar, y te devuelve una
receta con **cantidades, pasos y macros**. Lo que sale se abre en el editor de
siempre, así que se puede retocar antes de guardar; si no guardas, no existe.

**El reparto del plato.** De partida, una comida es 50 % proteína / 25 % verdura
/ 25 % hidrato, y una cena 25 / 50 / 25. No es obligatorio: son los números que
aparecen puestos y se cambian en *Ajustar porcentajes*. No hace falta que sumen
100, se usa la proporción entre los tres.

**Las cantidades salen en crudo.** El reparto se hace sobre la comida **ya
hecha** y luego se convierte, porque el arroz casi triplica su peso al hervir y
el pollo pierde un cuarto. Repartir en crudo daría un plato que es casi todo
arroz. Cada alimento lleva su factor en `src/lib/alimentos.ts`.

Además hay **preparación** (decide los pasos y el aceite), **salsas**, **extras**
y **especias**. Salsas y extras van con ración fija: no entran en el reparto,
pero sí escalan con los comensales. Las especias van sin cantidad y marcadas
como básicas, así que **no aparecen en la lista de la compra** — igual que la
sal o el aceite.

**Las calorías no se guardan en ningún sitio.** Se deducen del nombre de cada
ingrediente contra el catálogo (`src/lib/nutricion.ts`), así que funcionan igual
en las recetas escritas a mano y en las que traiga una IA, y si mañana se corrige
un número del catálogo se corrigen todas las recetas a la vez. Cuando no se
reconocen al menos dos tercios de los ingredientes, la ficha no enseña macros:
un número a medias engaña más de lo que ayuda.

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
npm test     # tests de la fusión y del mapeo de calendario
npm run verify   # build + tests + comprobar que no se filtran secretos
```

Sin más configuración la app ya funciona, guardando los datos en el navegador.

## En producción

- **App:** https://recetitasamorosas.vercel.app
- **Backend:** proyecto Supabase `recetario` (región `eu-west-1`).

La rama de producción es `claude/hola-8ryaj0`: cada push despliega solo.
En el móvil, *Compartir → Añadir a pantalla de inicio* la instala como app
(el manifest y los iconos ya están puestos).

Ya están configurados: el esquema y sus políticas RLS, Realtime, el registro
público **desactivado**, las URLs de redirección, las variables de entorno en
Vercel y las credenciales de Google Calendar.

Queda por hacer a mano: **crear las dos cuentas** (ver abajo) y **publicar la app
en Google Cloud** si sigue en estado "Prueba" (ver Google Calendar).

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

## Backend

Las funciones serverless viven en `api/` y las despliega Vercel sola. Hacen falta
porque el navegador no puede guardar un refresh token de Google ni recibir la
llamada de Alexa.

El `rewrites` de `vercel.json` lleva una negación (`/((?!api/).*)`) a propósito:
sin ella, el catch-all de la SPA se traga las rutas de API y `/api/loquesea`
devuelve el `index.html` con un 200 tan tranquilo. `GET /api/ping` sirve para
comprobar de un vistazo que eso sigue bien.

Los secretos de servidor van en variables **sin** el prefijo `VITE_`, que es lo
que las dejaría dentro del bundle público.

## Google Calendar

Sincroniza en las dos direcciones, y cada persona conecta su propia cuenta
porque "quién no come en casa" es individual.

**Leer.** Los eventos que afectan a una comida entran como planes marcados
*calendario*. Se combinan dos señales: que el evento pise la franja de comer
(13:00–16:00) o la de cenar (20:30–23:00), y palabras clave configurables. Lo
demás se ignora a propósito: una reunión de las 10 o un cumpleaños no tienen
nada que ver con si esa noche hay que cocinar.

Si un plan importado sobra, el botón de borrar lo apunta como **ignorado** y no
vuelve. Si lo editas a mano deja de ser de Google y ya no se refresca.

> Cuidado al añadir palabras clave vagas. `fuera` parece buena idea hasta que
> "comer fuera" te borra también la cena — pasó durante el desarrollo y lo pilló
> un test.

**Escribir.** Las comidas se publican en un calendario aparte llamado
**Recetario**, que se puede ocultar sin ensuciar el principal. No se guarda el id
de cada evento: en cada sincronización se compara el calendario con el plan y se
crea, actualiza o borra lo que haga falta. Así no hay estado que se descuadre, y
si alguien borra un evento a mano, la siguiente sincronización lo repone.

**Sin bucles**, con dos cierres: el calendario "Recetario" se excluye siempre al
leer, y además cada evento que crea la app lleva una marca en
`extendedProperties` para reconocerlo aunque llegara a leerse.

Sincroniza al abrir la app (como mucho cada 30 min) y una vez al día por cron.

### Conectarlo (Google Cloud Console)

El panel de Google movió estos ajustes: ya **no** están en "APIs y servicios →
Credenciales", sino en una sección aparte llamada **Google Auth Platform**. Los
enlaces directos van más rápido que buscarlos por el menú.

**1. Proyecto y API.** Crea un proyecto (selector arriba a la izquierda) y activa
la API de Calendar:
<https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> →
**Habilitar**.

**2. Configura la pantalla de consentimiento.**
<https://console.cloud.google.com/auth/overview> → **Comenzar**. Te pedirá:

- *Nombre de la app*: Recetario. *Correo de asistencia*: el tuyo.
- *Público*: **Externo**. (Interno solo existe con Google Workspace; con cuentas
  de Gmail normales no aparece.)
- *Datos de contacto*: tu correo.

**3. Estado de publicación.** <https://console.cloud.google.com/auth/audience>

Aquí hay que elegir, y las dos opciones son válidas:

- **Prueba** (lo que usamos). Añade los dos correos en *Usuarios de prueba*.
  Funciona todo, pero Google caduca el permiso **cada 7 días** y hay que volver
  a conectar. La app avisa con un aviso y un botón de reconectar en cuanto pasa,
  así que son dos toques por semana.
- **En producción**. El permiso ya no caduca, pero Google exige un **dominio
  autorizado verificado en Search Console**, y `vercel.app` no sirve porque el
  dominio no es tuyo. Hace falta un dominio propio (~10 €/año) o uno gratuito de
  <https://nic.eu.org> (gratis de verdad, pero la aprobación tarda días).

Publicar **no** obliga a pasar la verificación de Google para uso personal con
menos de 100 usuarios; lo único que hace falta es el dominio.

**4. Crea las credenciales.**
<https://console.cloud.google.com/auth/clients> → **Crear cliente**:

- *Tipo de aplicación*: **Aplicación web**.
- *Nombre*: el que quieras, solo lo ves tú.
- *URIs de redirección autorizados* → **Añadir URI**:
  ```
  https://recetitasamorosas.vercel.app/api/google/callback
  ```
  Tiene que coincidir **exactamente**: sin barra final y con https.
- **Crear**. Copia el *ID de cliente* y el *secreto* — el secreto solo se enseña
  una vez.

Luego, en Vercel → *Settings → Environment Variables*:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

y vuelve a desplegar.

**5. Al conectar por primera vez** saldrá un aviso de *"Google no ha verificado
esta aplicación"*. Es lo normal en una app privada sin verificar: pulsa
**Configuración avanzada → Ir a Recetario (no seguro)**. Solo la primera vez, y
solo para las personas que conectáis vosotros.

Hasta que esas dos variables estén puestas, la sección dice "sin configurar" y el
resto de la app funciona igual.

## Alexa

Skill privada, en modo desarrollo: solo funciona en vuestras cuentas de Amazon,
así que no pasa certificación ni necesita *account linking*.

Qué entiende:

| Dices | Hace |
|---|---|
| *«Alexa, pregunta a libreta violeta qué cenamos hoy»* | Lee el plan de ese día |
| *«Alexa, dile a libreta violeta que apunte tomates»* | Lo añade a la compra |
| *«Alexa, pregunta a libreta violeta qué lleva las lentejas»* | Enumera los ingredientes |
| *«Alexa, pregunta a libreta violeta cómo se hacen las lentejas»* | Los pasos, uno a uno; di «siguiente» |
| *«Alexa, dile a libreta violeta que Andrea come fuera mañana»* | Crea el plan y recalcula la compra |

Si no dices si es comida o cena, se deduce de la hora: antes de las cuatro,
comida; después, cena. Preguntar «¿comida o cena?» a las nueve de la noche sería
de robot.

### Seguridad del endpoint

`/api/alexa` está abierto a internet, así que:

- **Se verifica la firma de Amazon** contra el cuerpo **crudo** de la petición.
  Por eso el endpoint desactiva el parseo automático (`bodyParser: false`):
  parsear y volver a serializar cambia algún byte y la firma dejaría de cuadrar.
- **Se comprueba el id de la skill.** Que una petición venga firmada por Amazon
  solo prueba que viene de Alexa, no de *vuestra* Alexa. Sin `ALEXA_SKILL_ID`
  configurado el endpoint **no atiende a nadie**: falla cerrado a propósito.
- **Se rechazan las peticiones de más de 150 segundos**, que es lo que frena
  reenviar una capturada.

### Montarla (Amazon Developer Console)

1. [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask)
   → **Crear Skill**. Nombre: Recetitas Amorosas. Idioma: **Español (ES)**.
   Modelo: **Custom**. Alojamiento: **Provision your own**.
> El nombre de invocación es **libreta violeta**, y no describe nada a
> propósito. Alexa+ interpreta el nombre por su SIGNIFICADO: con «recetario»
> contestaba «tu biblioteca de cocina está vacía», y con «recetitas amorosas»
> se ponía a buscar recetas románticas en internet. Las dos veces sin llegar a
> llamar a la skill. Un nombre que suene a cocina siempre pierde contra la
> función de recetas que Alexa ya trae; hace falta uno que no signifique nada.

2. En **Build → JSON Editor**, pega el contenido de
   [`alexa/modelo-interaccion.json`](alexa/modelo-interaccion.json) y guarda.
   Luego **Build Model**.
3. En **Build → Endpoint**, elige **HTTPS** y pon:
   ```
   https://recetitasamorosas.vercel.app/api/alexa
   ```
   En el desplegable del certificado: *«Mi punto de enlace es un subdominio de
   un dominio que tiene un certificado comodín de una autoridad certificadora»*.
4. Copia el **Skill ID** (arriba, junto al nombre) y añádelo en Vercel como
   `ALEXA_SKILL_ID`. Vuelve a desplegar.
5. Pruébala desde la pestaña **Test** de la consola, poniendo el desplegable en
   **Development**. Al estar tu cuenta de Amazon vinculada, también funcionará
   en tus Echo.

Si cambias los nombres de las personas en la app, actualiza también el tipo
`Persona` del modelo de interacción y vuelve a hacer **Build Model**.

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
    alimentos.ts    catalogo de alimentos con macros y rendimiento al cocinar
    nutricion.ts    calorias de una receta, deducidas del nombre (+ tests)
    constructor.ts  reparto del plato, preparaciones y pasos (+ tests)
    plan.ts         quién come en casa cada día
    validate.ts     saneado de JSON de fuera; nunca lanza
    aiPrompt.ts     instrucciones que acompañan al export
    supabase.ts     sincronización opcional (carga perezosa)
    merge.ts        fusión sin perder lo que hizo el otro (+ merge.test.ts)
    valoracion.ts   estrellas por persona y media (+ tests)
    snapshots.ts    copias locales para poder deshacer
    calendar.ts     evento de Google -> plan (+ calendar.test.ts)
    alexa.ts        lo que la skill entiende y contesta (+ tests)
    googleClient.ts llamadas a api/google desde el navegador
api/
  ping.ts         comprueba que las funciones responden
  _lib/           supabase con service_role, y cliente de Google
  google/         auth, callback, sync, estado, desconectar
  alexa.ts        endpoint de la skill, con verificacion de firma
scripts/
  verificar-secretos.mjs   que nada secreto acabe en dist/
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
