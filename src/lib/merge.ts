import type { AppData, Recipe, Tombstone } from '../types.js';

/**
 * Fusion de dos copias del recetario.
 *
 * Antes esto era "gana el documento con `updatedAt` mas reciente", lo que
 * significaba que si Andrea tachaba la compra en el super mientras Javi editaba
 * una receta en casa, el ultimo en guardar borraba el trabajo del otro sin
 * avisar. Ahora se fusiona elemento a elemento.
 *
 * Reglas:
 *  - Colecciones con `id`: se unen; de cada id gana la version con `updatedAt`
 *    mas alto. Sin sello, se prefiere la remota (es la copia compartida).
 *  - Lo borrado deja lapida, para que el otro lado no lo resucite. Una lapida
 *    solo mata a versiones anteriores a ella: si vuelves a editar algo despues
 *    de borrarlo, revive.
 *  - Campos que son un ajuste global (compradosIds, despensa, people): son de
 *    quien guardo el ultimo, porque fusionarlos por union romperia el poder
 *    desmarcar algo.
 */

interface ConId {
  id: string;
  updatedAt?: string;
}

/** Momento efectivo de un elemento. Sin sello vale '', que pierde con todo. */
function sello(x: ConId): string {
  return x.updatedAt ?? '';
}

/**
 * `combinar` deja rescatar del perdedor lo que no deberia morir con el.
 * Sin eso, el elemento entero es de quien guardo el ultimo.
 */
function mezclarLista<T extends ConId>(
  local: T[],
  remoto: T[],
  lapidas: Map<string, string>,
  combinar?: (gana: T, pierde: T) => T,
): T[] {
  const porId = new Map<string, T>();

  for (const item of local) porId.set(item.id, item);

  for (const item of remoto) {
    const mio = porId.get(item.id);
    if (!mio) {
      porId.set(item.id, item);
      continue;
    }
    // Empate sin sellos: gana el remoto, que es la copia compartida.
    const ganaRemoto = sello(item) >= sello(mio);
    const gana = ganaRemoto ? item : mio;
    const pierde = ganaRemoto ? mio : item;
    porId.set(item.id, combinar ? combinar(gana, pierde) : gana);
  }

  const salida: T[] = [];
  for (const item of porId.values()) {
    const borradoEn = lapidas.get(item.id);
    // La lapida solo gana si es posterior a la ultima edicion del elemento.
    if (borradoEn !== undefined && borradoEn >= sello(item)) continue;
    salida.push(item);
  }
  return salida;
}

/** Une las lapidas de ambos lados quedandose con la mas reciente de cada id. */
function mezclarLapidas(local: Tombstone[], remoto: Tombstone[]): Tombstone[] {
  const porId = new Map<string, string>();
  for (const t of [...local, ...remoto]) {
    const previa = porId.get(t.id);
    if (previa === undefined || t.at > previa) porId.set(t.id, t.at);
  }
  return [...porId.entries()].map(([id, at]) => ({ id, at }));
}

/**
 * La valoracion de cada uno es suya: no puede perderse porque el otro guarde la
 * receta un segundo despues. Se unen por persona, y la version que gana manda
 * sobre las claves que trae — incluido el 0 con el que se quita una valoracion.
 */
function combinarRecetas(gana: Recipe, pierde: Recipe): Recipe {
  if (!pierde.ratings) return gana;
  return { ...gana, ratings: { ...pierde.ratings, ...(gana.ratings ?? {}) } };
}

const DIAS_LAPIDA = 30;

/** Quita lapidas viejas: pasado un mes ya no hay copia por ahi que resucite nada. */
function podar(lapidas: Tombstone[]): Tombstone[] {
  const limite = new Date(Date.now() - DIAS_LAPIDA * 24 * 60 * 60 * 1000).toISOString();
  return lapidas.filter((t) => t.at >= limite);
}

/**
 * Los ajustes de integraciones son de quien guardo el ultimo, como el resto de
 * ajustes globales. La excepcion es `ignorados`: es una lista de "esto no lo
 * quiero ver mas", asi que se unen las dos. Perder una entrada devolveria a la
 * semana un evento que ya habias echado.
 */
function mezclarIntegraciones(
  local: AppData,
  remoto: AppData,
  reciente: AppData,
): AppData['integraciones'] {
  const ajustes = reciente.integraciones;
  if (!ajustes?.google) return ajustes ?? local.integraciones ?? remoto.integraciones;
  const ignorados = new Set([
    ...(local.integraciones?.google?.ignorados ?? []),
    ...(remoto.integraciones?.google?.ignorados ?? []),
  ]);
  return { ...ajustes, google: { ...ajustes.google, ignorados: [...ignorados] } };
}

export function merge(local: AppData, remoto: AppData): AppData {
  const lapidas = podar(mezclarLapidas(local.deleted ?? [], remoto.deleted ?? []));
  const mapa = new Map(lapidas.map((t) => [t.id, t.at]));

  // Los ajustes globales son de quien guardo el ultimo.
  const ganaRemoto = remoto.updatedAt >= local.updatedAt;
  const reciente = ganaRemoto ? remoto : local;

  return {
    version: 1,
    people: reciente.people,
    recipes: mezclarLista(local.recipes, remoto.recipes, mapa, combinarRecetas),
    plan: mezclarLista(local.plan, remoto.plan, mapa),
    events: mezclarLista(local.events, remoto.events, mapa),
    compra: mezclarLista(local.compra, remoto.compra, mapa),
    deleted: lapidas,
    // Sin esto los ajustes de Google se perdian en CADA fusion, que es en cada
    // carga y cada vez que el otro movil tocaba algo.
    integraciones: mezclarIntegraciones(local, remoto, reciente),
    compradosIds: reciente.compradosIds,
    despensa: reciente.despensa,
    updatedAt: ganaRemoto ? remoto.updatedAt : local.updatedAt,
  };
}

/** Marca ids como borrados. Usalo en vez de filtrarlos y ya esta. */
export function conLapidas(data: AppData, ids: string[]): Tombstone[] {
  const at = new Date().toISOString();
  return [...(data.deleted ?? []).filter((t) => !ids.includes(t.id)), ...ids.map((id) => ({ id, at }))];
}

/** Sella un elemento como tocado ahora, para que gane al fusionar. */
export function sellar<T extends object>(item: T): T & { updatedAt: string } {
  return { ...item, updatedAt: new Date().toISOString() };
}
