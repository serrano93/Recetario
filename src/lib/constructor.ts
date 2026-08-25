import type { Ingredient, Recipe, Slot } from '../types.js';
import type { Alimento } from './alimentos.js';
import { ALIMENTOS } from './alimentos.js';
import { buscarAlimento } from './nutricion.js';

/**
 * Constructor de recetas: de "pollo, brocoli y arroz" a una receta con
 * cantidades, pasos y macros.
 *
 * La idea de fondo es el reparto del plato. En vez de adivinar cuanto arroz
 * poner, se decide que porcentaje del plato ocupa cada cosa (por defecto 50 /
 * 25 / 25 en la comida y 25 / 50 / 25 en la cena) y de ahi salen los gramos.
 *
 * El detalle que hace que los numeros no sean ridiculos es que el reparto se
 * hace sobre el peso YA COCINADO y luego se convierte a crudo. El arroz
 * triplica su peso al hervir y el pollo pierde una cuarta parte: repartir en
 * crudo daria un plato que es casi todo arroz.
 *
 * Lo que sale de aqui es una receta normal y corriente. No queda marcada ni
 * atada al constructor: se abre en el editor de siempre y se toca a mano.
 */

export type Apetito = 'ligero' | 'normal' | 'hambre';

export interface Reparto {
  proteina: number;
  verdura: number;
  hidrato: number;
}

/** Gramos de comida ya cocinada por persona. */
const PESO_PLATO: Record<Apetito, Record<Slot, number>> = {
  ligero: { comida: 380, cena: 320 },
  normal: { comida: 460, cena: 390 },
  hambre: { comida: 560, cena: 470 },
};

export const APETITOS: { id: Apetito; label: string }[] = [
  { id: 'ligero', label: 'Ligero' },
  { id: 'normal', label: 'Normal' },
  { id: 'hambre', label: 'Con hambre' },
];

/**
 * El reparto de partida. No es obligatorio: son los numeros que aparecen
 * puestos, y desde el constructor se cambian.
 */
export const REPARTO_POR_DEFECTO: Record<Slot, Reparto> = {
  comida: { proteina: 50, verdura: 25, hidrato: 25 },
  cena: { proteina: 25, verdura: 50, hidrato: 25 },
};

/* --- Preparaciones ------------------------------------------------------- */

interface Contexto {
  proteinas: string[];
  verduras: string[];
  hidratos: string[];
  salsas: string[];
  alinos: string[];
  extras: string[];
}

export interface Preparacion {
  id: string;
  nombre: string;
  /** Aceite en ml por comensal. Cuenta en calorias aunque no vaya a la compra. */
  aceite: number;
  /** Minutos aproximados de la preparacion en si. */
  minutos: number;
  /**
   * Como se nombra el plato: "pollo AL HORNO con patatas".
   * Tiene que valer para cualquier alimento, asi que nada de participios:
   * "carne picada guisado" no se sostiene, "carne picada en guiso" si.
   */
  sufijo?: string;
  pasos: (c: Contexto) => string[];
}

/** "a, b y c" */
export function lista(xs: string[]): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/** Los pasos del acompanamiento son los mismos casi siempre. */
function pasosHidrato(c: Contexto): string[] {
  if (c.hidratos.length === 0) return [];
  return [`Cocer ${lista(c.hidratos)} según indique el paquete y escurrir.`];
}

function pasosRemate(c: Contexto): string[] {
  const pasos: string[] = [];
  if (c.salsas.length > 0) pasos.push(`Añadir ${lista(c.salsas)} y dar unas vueltas para que ligue.`);
  if (c.alinos.length > 0) pasos.push(`Sazonar con ${lista(c.alinos)} y probar de sal.`);
  if (c.extras.length > 0) pasos.push(`Servir con ${lista(c.extras)} por encima.`);
  return pasos;
}

export const PREPARACIONES: Preparacion[] = [
  {
    id: 'plancha',
    nombre: 'A la plancha',
    sufijo: 'a la plancha',
    aceite: 5,
    minutos: 15,
    pasos: (c) => [
      ...pasosHidrato(c),
      `Salpimentar ${lista(c.proteinas)} y calentar la sartén a fuego fuerte con un hilo de aceite.`,
      `Marcar ${lista(c.proteinas)} 3-4 minutos por cada lado, hasta que esté dorado. Reservar.`,
      ...(c.verduras.length
        ? [`En la misma sartén, saltear ${lista(c.verduras)} 5-6 minutos, que queden al dente.`]
        : []),
      ...pasosRemate(c),
    ],
  },
  {
    id: 'horno',
    nombre: 'Al horno',
    sufijo: 'al horno',
    aceite: 10,
    minutos: 35,
    pasos: (c) => [
      'Precalentar el horno a 200°C con calor arriba y abajo.',
      `Cortar ${lista(c.verduras.length ? c.verduras : c.proteinas)} en trozos parecidos para que se hagan a la vez.`,
      `Extender ${lista([...c.proteinas, ...c.verduras])} en una bandeja, regar con aceite y salpimentar.`,
      'Hornear 25-30 minutos, dando la vuelta a mitad.',
      ...pasosHidrato(c),
      ...pasosRemate(c),
    ],
  },
  {
    id: 'airfryer',
    nombre: 'Air fryer',
    sufijo: 'en air fryer',
    aceite: 3,
    minutos: 25,
    pasos: (c) => [
      `Trocear ${lista([...c.proteinas, ...c.verduras])} y mezclar con un poco de aceite y sal.`,
      'Precalentar la air fryer a 200°C un par de minutos.',
      'Hacer en dos tandas si no cabe en una capa: 15-18 minutos, agitando el cestillo a mitad.',
      ...pasosHidrato(c),
      ...pasosRemate(c),
    ],
  },
  {
    id: 'salteado',
    nombre: 'Salteado / wok',
    sufijo: 'al wok',
    aceite: 10,
    minutos: 20,
    pasos: (c) => [
      ...pasosHidrato(c),
      `Cortar ${lista([...c.proteinas, ...c.verduras])} en tiras finas: en el wok todo se hace muy rápido.`,
      `Con el wok muy caliente, saltear ${lista(c.proteinas)} 2-3 minutos y sacar.`,
      `Saltear ${lista(c.verduras)} empezando por las más duras, 4-5 minutos.`,
      'Devolver la proteína al wok y mezclar.',
      ...pasosRemate(c),
    ],
  },
  {
    id: 'guiso',
    nombre: 'Guisado',
    sufijo: 'en guiso',
    aceite: 10,
    minutos: 50,
    pasos: (c) => [
      `Pochar ${lista(c.verduras.slice(0, 2).length ? c.verduras.slice(0, 2) : ['la cebolla'])} a fuego suave 8-10 minutos.`,
      `Subir el fuego y dorar ${lista(c.proteinas)} por todos lados.`,
      ...(c.verduras.length > 2 ? [`Añadir ${lista(c.verduras.slice(2))} y rehogar 5 minutos.`] : []),
      ...(c.salsas.length ? [`Incorporar ${lista(c.salsas)}.`] : ['Cubrir con caldo o agua.']),
      'Tapar y dejar a fuego lento 30 minutos, hasta que la carne esté tierna.',
      ...pasosHidrato(c),
      ...(c.alinos.length ? [`Ajustar de ${lista(c.alinos)} al final.`] : []),
      ...(c.extras.length ? [`Servir con ${lista(c.extras)}.`] : []),
    ],
  },
  {
    id: 'vapor',
    nombre: 'Al vapor',
    sufijo: 'al vapor',
    aceite: 0,
    minutos: 25,
    pasos: (c) => [
      `Poner ${lista(c.verduras)} en el cestillo del vapor 8-10 minutos, que queden firmes.`,
      `Cocer ${lista(c.proteinas)} al vapor 10-12 minutos, o a la plancha si se prefiere dorado.`,
      ...pasosHidrato(c),
      ...pasosRemate(c),
    ],
  },
  {
    id: 'papillote',
    nombre: 'Papillote',
    sufijo: 'en papillote',
    aceite: 5,
    minutos: 30,
    pasos: (c) => [
      'Precalentar el horno a 190°C.',
      `Hacer una cama con ${lista(c.verduras)} sobre papel de horno.`,
      `Colocar ${lista(c.proteinas)} encima, salpimentar y regar con un chorrito de aceite.`,
      'Cerrar el paquete bien sellado y hornear 20-25 minutos.',
      ...pasosHidrato(c),
      'Abrir el papillote en la mesa: el vapor que sale es medio plato.',
      ...pasosRemate(c),
    ],
  },
  {
    id: 'ensalada',
    nombre: 'Ensalada / en frío',
    aceite: 10,
    minutos: 15,
    pasos: (c) => [
      ...pasosHidrato(c),
      `Lavar y cortar ${lista(c.verduras)}.`,
      `Cocinar ${lista(c.proteinas)} a la plancha, dejar templar y trocear.`,
      'Mezclar todo en un bol grande.',
      ...(c.salsas.length ? [`Aliñar con ${lista(c.salsas)}.`] : ['Aliñar con aceite, vinagre y sal.']),
      ...(c.alinos.length ? [`Rematar con ${lista(c.alinos)}.`] : []),
      ...(c.extras.length ? [`Añadir ${lista(c.extras)} justo antes de servir.`] : []),
    ],
  },
];

export function preparacionPorId(id: string): Preparacion {
  return PREPARACIONES.find((p) => p.id === id) ?? PREPARACIONES[0];
}

/* --- Calculo de cantidades ----------------------------------------------- */

export interface Seleccion {
  slot: Slot;
  /** Para cuanta gente. Normalmente 1 o 2. */
  comensales: number;
  apetito: Apetito;
  reparto: Reparto;
  proteinas: string[];
  verduras: string[];
  hidratos: string[];
  preparacion: string;
  salsas: string[];
  alinos: string[];
  extras: string[];
}

export function seleccionInicial(slot: Slot = 'comida', comensales = 2): Seleccion {
  return {
    slot,
    comensales,
    apetito: 'normal',
    reparto: { ...REPARTO_POR_DEFECTO[slot] },
    proteinas: [],
    verduras: [],
    hidratos: [],
    preparacion: 'plancha',
    salsas: [],
    alinos: [],
    extras: [],
  };
}

/** En el super y en la bascula nadie pesa 137 g: se redondea a algo decente. */
function redondear(gramos: number): number {
  if (gramos <= 0) return 0;
  if (gramos < 20) return Math.max(1, Math.round(gramos));
  if (gramos < 100) return Math.round(gramos / 5) * 5;
  return Math.round(gramos / 10) * 10;
}

function porNombre(nombre: string): Alimento | null {
  return ALIMENTOS.find((a) => a.nombre === nombre) ?? buscarAlimento(nombre);
}

/** Convierte gramos crudos en la linea de ingrediente del alimento. */
function comoIngrediente(alimento: Alimento, gramosCrudos: number): Ingredient {
  if (alimento.unidad === 'ud') {
    const porPieza = alimento.gramosPorUnidad ?? 100;
    return {
      name: alimento.nombre,
      qty: Math.max(1, Math.round(gramosCrudos / porPieza)),
      unit: 'ud',
      ...(alimento.basico ? { basico: true } : {}),
    };
  }
  return {
    name: alimento.nombre,
    qty: redondear(gramosCrudos),
    unit: alimento.unidad,
    ...(alimento.basico ? { basico: true } : {}),
  };
}

/**
 * Reparte el peso del plato entre los alimentos de una categoria.
 *
 * `porcentaje` no tiene que sumar 100 con los demas: se usa la proporcion, asi
 * que se pueden mover los tres numeros sin pelearse para que cuadren.
 */
function repartir(nombres: string[], gramosCocidos: number): Ingredient[] {
  if (nombres.length === 0) return [];
  const porAlimento = gramosCocidos / nombres.length;
  const out: Ingredient[] = [];
  for (const nombre of nombres) {
    const alimento = porNombre(nombre);
    if (!alimento) {
      out.push({ name: nombre });
      continue;
    }
    out.push(comoIngrediente(alimento, porAlimento / alimento.rinde));
  }
  return out;
}

/** Salsas, extras y aliños no entran en el reparto: llevan su racion y punto. */
function porRaciones(nombres: string[], comensales: number): Ingredient[] {
  const out: Ingredient[] = [];
  for (const nombre of nombres) {
    const alimento = porNombre(nombre);
    if (!alimento) {
      out.push({ name: nombre });
      continue;
    }
    if (!alimento.racion) {
      out.push({ name: alimento.nombre, ...(alimento.basico ? { basico: true } : {}) });
      continue;
    }
    out.push(comoIngrediente(alimento, alimento.racion * comensales));
  }
  return out;
}

export function nombreSugerido(sel: Seleccion): string {
  const prep = preparacionPorId(sel.preparacion);
  const guarnicion = lista([...sel.hidratos, ...sel.verduras]);

  if (prep.id === 'ensalada') {
    const base = sel.verduras.length ? `Ensalada de ${lista(sel.verduras)}` : 'Ensalada';
    const con = [...sel.proteinas, ...sel.hidratos];
    return con.length ? `${base} con ${lista(con)}` : base;
  }

  const cabeza = sel.proteinas.length ? lista(sel.proteinas) : guarnicion;
  if (!cabeza) return '';
  const conSufijo = [cabeza, sel.proteinas.length ? prep.sufijo : ''].filter(Boolean).join(' ');
  const texto = sel.proteinas.length && guarnicion ? `${conSufijo} con ${guarnicion}` : conSufijo;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** La receta que sale del constructor, lista para abrir en el editor. */
export type Borrador = Omit<Recipe, 'id' | 'updatedAt'>;

export function construirReceta(sel: Seleccion): Borrador {
  const prep = preparacionPorId(sel.preparacion);
  const comensales = sel.comensales > 0 ? sel.comensales : 1;
  const plato = PESO_PLATO[sel.apetito][sel.slot] * comensales;

  const suma = sel.reparto.proteina + sel.reparto.verdura + sel.reparto.hidrato;
  const parte = (pct: number) => (suma > 0 ? (plato * pct) / suma : 0);

  const ingredients: Ingredient[] = [
    ...repartir(sel.proteinas, parte(sel.reparto.proteina)),
    ...repartir(sel.verduras, parte(sel.reparto.verdura)),
    ...repartir(sel.hidratos, parte(sel.reparto.hidrato)),
    ...porRaciones(sel.salsas, comensales),
    ...porRaciones(sel.extras, comensales),
    ...porRaciones(sel.alinos, comensales),
  ];

  if (prep.aceite > 0) {
    ingredients.push({
      name: 'aceite de oliva',
      qty: redondear(prep.aceite * comensales),
      unit: 'ml',
      basico: true,
    });
  }

  const contexto: Contexto = {
    proteinas: sel.proteinas,
    verduras: sel.verduras,
    hidratos: sel.hidratos,
    salsas: sel.salsas,
    alinos: sel.alinos,
    extras: sel.extras,
  };

  const tags = [prep.id];
  if (prep.minutos <= 20) tags.push('rápido');
  if (sel.proteinas.every((p) => ['soja texturizada', 'tofu', 'huevos'].includes(p))) {
    if (sel.proteinas.length > 0) tags.push('vegetariano');
  }

  return {
    name: nombreSugerido(sel),
    tags,
    servings: comensales,
    minutes: prep.minutos,
    ingredients,
    steps: prep.pasos(contexto).filter(Boolean).join('\n'),
    fits: [sel.slot],
  };
}
