/**
 * Modelo de datos del Recetario.
 *
 * Todo el estado de la app vive en un unico objeto `AppData` serializable a JSON.
 * Esto es intencionado: permite exportarlo entero, pegarselo a una IA para que lo
 * edite en lenguaje natural, y volver a sobrescribirlo de una pieza.
 */

export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
  /** Color de acento para distinguir sus comidas en el calendario. */
  color: string;
}

/** Momento del dia en el que se come. */
export type Slot = 'comida' | 'cena';

export const SLOTS: Slot[] = ['comida', 'cena'];

export interface Ingredient {
  /** Nombre del ingrediente principal, en minusculas. Ej: "pechuga de pollo". */
  name: string;
  /** Cantidad para las raciones base de la receta. Opcional ("al gusto"). */
  qty?: number;
  /** Unidad libre: g, kg, ml, l, ud, lata, manojo... */
  unit?: string;
  /**
   * Si es true no se anade a la lista de la compra (sal, aceite, especias...).
   * Tambien se filtra automáticamente lo que este en `data.despensa`.
   */
  basico?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  /** Etiquetas libres: "rapido", "vegetariano", "batch cooking", "tupper"... */
  tags: string[];
  /** Raciones para las que estan calculadas las cantidades. */
  servings: number;
  /** Minutos aproximados de preparacion. */
  minutes?: number;
  ingredients: Ingredient[];
  /** Pasos en texto libre, una linea por paso. */
  steps: string;
  notes?: string;
  /** Slots para los que encaja la receta. Vacio = vale para todo. */
  fits: Slot[];
  /** Marcada como favorita, sale primero en el listado. */
  favorite?: boolean;
  /**
   * Lo que le pone cada uno, de 0,5 a 5 en medias estrellas.
   *
   * Un 0 no es "no valorada": es "la quito a proposito". Hace falta poder
   * distinguirlo, porque al fusionar con el otro movil una clave que
   * desaparece y una clave puesta a cero se resuelven al reves.
   */
  ratings?: Record<PersonId, number>;
  /** Ultima vez que se toco. Lo usa la fusion para saber que version gana. */
  updatedAt?: string;
}

/**
 * Una comida planificada en un dia y momento concretos.
 *
 * `people` decide para quien es: con los dos ids es una comida compartida,
 * con uno solo es una comida individual (cada uno lo suyo ese dia).
 */
export interface PlanEntry {
  id: string;
  /** Fecha ISO local, YYYY-MM-DD. */
  date: string;
  slot: Slot;
  people: PersonId[];
  /** Receta del recetario. Si falta, se usa `text`. */
  recipeId?: string;
  /** Texto libre cuando no hay receta: "sobras", "pizza congelada". */
  text?: string;
  /** Ya cocinado/comido: se tacha y deja de contar para la compra. */
  done?: boolean;
  /**
   * Se cocina la tanda entera de la receta, no solo las raciones de quien come.
   * Media olla de lentejas no existe: con esto la compra pide los ingredientes
   * completos de la receta y sobra comida a proposito.
   */
  batch?: boolean;
  /**
   * Esta comida son las sobras de otra entrada del plan (su id).
   * No suma nada en la lista de la compra: ya se compro al cocinar la tanda.
   */
  leftoverOf?: string;
  /** Ultima vez que se toco. Lo usa la fusion para saber que version gana. */
  updatedAt?: string;
}

/**
 * Un plan que NO es una comida: viajes, comer fuera, invitados, cualquier cosa.
 *
 * Si `blocks` incluye un slot, esas personas no necesitan comida en casa ese dia
 * y el planificador lo marca como cubierto en vez de pedirte que cocines.
 */
export interface PlanEvent {
  id: string;
  /** Titulo libre: "Javi come fuera", "Andrea de viaje", "Cena con Marta". */
  title: string;
  /** A quien afecta. Vacio = a los dos. */
  people: PersonId[];
  /** Fecha ISO de inicio (incluida). */
  from: string;
  /** Fecha ISO de fin (incluida). Igual a `from` si es de un solo dia. */
  to: string;
  /** Slots en los que esas personas no comen en casa. Vacio = solo es una nota. */
  blocks: Slot[];
  notes?: string;
  /**
   * De donde sale. 'google' = importado del calendario, y se refresca solo en
   * cada sincronizacion. Al editarlo a mano pasa a 'app' y deja de tocarse.
   */
  origen?: 'app' | 'google';
  /** Id del evento en Google, para reconocerlo entre sincronizaciones. */
  externalId?: string;
  /**
   * Desde que cuenta de Google se trajo. NO es lo mismo que `people`: en un
   * calendario compartido, la cuenta de Javi puede traer un viaje de Andrea.
   * Sirve para saber que refrescar en cada sincronizacion.
   */
  importadoPor?: PersonId;
  /** Ultima vez que se toco. Lo usa la fusion para saber que version gana. */
  updatedAt?: string;
}

/** Item añadido a mano a la lista de la compra (no viene de ninguna receta). */
export interface ManualItem {
  id: string;
  name: string;
  qty?: number;
  unit?: string;
  /** Ultima vez que se toco. Lo usa la fusion para saber que version gana. */
  updatedAt?: string;
}

/**
 * Lapida de algo borrado.
 *
 * Sin esto, al fusionar con el otro movil lo borrado reaparece: para el otro
 * lado es simplemente "un elemento que yo tengo y tu no".
 */
export interface Tombstone {
  id: string;
  /** Momento del borrado, en ISO. */
  at: string;
}

/**
 * Ajustes de la sincronizacion con Google Calendar.
 * Aqui NO hay secretos: los tokens viven en la tabla `integraciones` de
 * Supabase, a la que el navegador no llega. Esto se sirve al cliente entero.
 */
export interface AjustesGoogle {
  /** Traer del calendario quien no come en casa. */
  leer: boolean;
  /** Publicar las comidas como eventos en el calendario principal. */
  escribir: boolean;
  /** Hora a la que se publican, en formato "14:00". */
  horaComida: string;
  horaCena: string;
  /** Palabras clave que deciden que bloquea cada evento. */
  reglas: {
    todoElDia: string[];
    bloqueaComida: string[];
    bloqueaCena: string[];
  };
  /** Ids de eventos de Google que no queremos volver a importar. */
  ignorados: string[];
  /**
   * A quien afecta cada calendario, por su id. 'ignorar' lo deja fuera.
   * Sin entrada, se asume que es de quien conecto la cuenta.
   */
  calendarios?: Record<string, PersonId[] | 'ignorar'>;
  /** Calendarios encontrados en la ultima sincronizacion, para poder listarlos. */
  vistos?: { id: string; nombre: string; cuenta: PersonId }[];
  /** Ultima sincronizacion correcta, en ISO. */
  ultimaSync?: string;
}

export interface AppData {
  /** Version del esquema. Sube si el formato cambia de forma incompatible. */
  version: 1;
  people: Person[];
  recipes: Recipe[];
  plan: PlanEntry[];
  events: PlanEvent[];
  /** Items sueltos de la compra: papel de cocina, cervezas... */
  compra: ManualItem[];
  /** Ids borrados, para que la fusion no los resucite. Se podan a los 30 dias. */
  deleted?: Tombstone[];
  /** Ajustes de integraciones. Sin secretos: se sirve al navegador entero. */
  integraciones?: { google?: AjustesGoogle };
  /** Ingredientes marcados como comprados (clave normalizada del ingrediente). */
  compradosIds: string[];
  /**
   * Cosas que siempre hay en casa y nunca van a la lista de la compra.
   * Se comparan en minusculas y sin acentos.
   */
  despensa: string[];
  /** ISO timestamp de la ultima modificacion. Lo usa la sincronizacion. */
  updatedAt: string;
}

export const CURRENT_VERSION = 1 as const;
