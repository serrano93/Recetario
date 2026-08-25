import type { AppData, Tombstone } from '../types.js';

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

function mezclarLista<T extends ConId>(local: T[], remoto: T[], lapidas: Map<string, string>): T[] {
  const porId = new Map<string, T>();

  for (const item of local) porId.set(item.id, item);

  for (const item of remoto) {
    const mio = porId.get(item.id);
    // Empate sin sellos: gana el remoto, que es la copia compartida.
    if (!mio || sello(item) >= sello(mio)) porId.set(item.id, item);
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

const DIAS_LAPIDA = 30;

/** Quita lapidas viejas: pasado un mes ya no hay copia por ahi que resucite nada. */
function podar(lapidas: Tombstone[]): Tombstone[] {
  const limite = new Date(Date.now() - DIAS_LAPIDA * 24 * 60 * 60 * 1000).toISOString();
  return lapidas.filter((t) => t.at >= limite);
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
    recipes: mezclarLista(local.recipes, remoto.recipes, mapa),
    plan: mezclarLista(local.plan, remoto.plan, mapa),
    events: mezclarLista(local.events, remoto.events, mapa),
    compra: mezclarLista(local.compra, remoto.compra, mapa),
    deleted: lapidas,
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
