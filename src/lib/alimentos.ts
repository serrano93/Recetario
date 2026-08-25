/**
 * Catalogo de alimentos con sus macros.
 *
 * Existe para dos cosas: que el constructor de recetas sepa proponer cantidades
 * y que cualquier receta (escrita a mano o traida por una IA) pueda mostrar
 * calorias aproximadas sin guardar nada extra en el documento. Por eso el
 * emparejamiento va por NOMBRE: lo que se guarda en la receta sigue siendo una
 * linea de texto normal, y esto solo la interpreta.
 *
 * Los numeros son aproximados y estan en crudo / tal como se compra, por 100 g.
 * No es una tabla nutricional: es una estimacion para saber si un plato se va
 * de madre o se queda corto.
 */

export type Categoria = 'proteina' | 'verdura' | 'hidrato' | 'salsa' | 'aliño' | 'extra' | 'grasa';

export interface Macros {
  /** Kilocalorias por 100 g. */
  kcal: number;
  /** Gramos de proteina por 100 g. */
  prot: number;
  /** Gramos de hidratos por 100 g. */
  hc: number;
  /** Gramos de grasa por 100 g. */
  grasa: number;
}

export interface Alimento {
  /** Nombre tal cual se escribira en la receta. */
  nombre: string;
  categoria: Categoria;
  /** Macros por 100 g del producto crudo / tal como se compra. */
  macros: Macros;
  /**
   * Cuanto pesa cocinado respecto a crudo.
   *
   * Es lo que evita que las cantidades salgan absurdas: el arroz triplica su
   * peso al hervir y el pollo pierde una cuarta parte, asi que repartir el
   * plato en crudo daria montanas de arroz y poco pollo.
   */
  rinde: number;
  /** Unidad con la que se escribe en la receta. */
  unidad: 'g' | 'ml' | 'ud';
  /** Si se mide en unidades, cuanto pesa cada una. */
  gramosPorUnidad?: number;
  /** Otras formas de llamarlo, para reconocerlo en recetas ya escritas. */
  sinonimos?: string[];
  /**
   * Racion fija en gramos. Las salsas y los extras no se reparten por
   * porcentaje del plato: llevan lo que llevan.
   */
  racion?: number;
  /** No va a la lista de la compra (especias, aceite, sal...). */
  basico?: boolean;
}

/* --- Proteinas ----------------------------------------------------------- */

const PROTEINAS: Alimento[] = [
  { nombre: 'contramuslo de pollo', categoria: 'proteina', unidad: 'g', rinde: 0.75,
    macros: { kcal: 120, prot: 19.5, hc: 0, grasa: 4.5 },
    sinonimos: ['contramuslos de pollo', 'muslo de pollo', 'jamoncitos de pollo'] },
  { nombre: 'pechuga de pollo', categoria: 'proteina', unidad: 'g', rinde: 0.75,
    macros: { kcal: 110, prot: 23, hc: 0, grasa: 1.8 },
    sinonimos: ['pollo', 'filetes de pollo'] },
  { nombre: 'lomo de cerdo', categoria: 'proteina', unidad: 'g', rinde: 0.72,
    macros: { kcal: 143, prot: 21, hc: 0, grasa: 6 },
    sinonimos: ['cinta de lomo', 'cerdo', 'solomillo de cerdo'] },
  { nombre: 'carne picada', categoria: 'proteina', unidad: 'g', rinde: 0.7,
    macros: { kcal: 200, prot: 18.5, hc: 0, grasa: 14 },
    sinonimos: ['carne picada mixta', 'picada'] },
  { nombre: 'ternera', categoria: 'proteina', unidad: 'g', rinde: 0.72,
    macros: { kcal: 135, prot: 21.5, hc: 0, grasa: 5.5 },
    sinonimos: ['filete de ternera', 'vaca', 'redondo de ternera'] },
  { nombre: 'pavo', categoria: 'proteina', unidad: 'g', rinde: 0.73,
    macros: { kcal: 110, prot: 22, hc: 0, grasa: 2 },
    sinonimos: ['pechuga de pavo', 'filetes de pavo'] },
  { nombre: 'salmón', categoria: 'proteina', unidad: 'g', rinde: 0.8,
    macros: { kcal: 208, prot: 20, hc: 0, grasa: 13.5 },
    sinonimos: ['lomo de salmón'] },
  { nombre: 'atún', categoria: 'proteina', unidad: 'g', rinde: 0.78,
    macros: { kcal: 130, prot: 23.5, hc: 0, grasa: 4 },
    sinonimos: ['lomo de atún', 'tataki de atún'] },
  { nombre: 'atún en lata', categoria: 'proteina', unidad: 'g', rinde: 1,
    macros: { kcal: 108, prot: 24, hc: 0, grasa: 1 },
    sinonimos: ['atún al natural', 'atún de lata', 'latas de atún'] },
  { nombre: 'merluza', categoria: 'proteina', unidad: 'g', rinde: 0.8,
    macros: { kcal: 72, prot: 16, hc: 0, grasa: 0.8 },
    sinonimos: ['lomos de merluza', 'bacalao', 'pescado blanco'] },
  { nombre: 'gambas', categoria: 'proteina', unidad: 'g', rinde: 0.85,
    macros: { kcal: 85, prot: 18, hc: 0.5, grasa: 1 },
    sinonimos: ['langostinos', 'gambón', 'camarones'] },
  { nombre: 'huevos', categoria: 'proteina', unidad: 'ud', rinde: 1, gramosPorUnidad: 55,
    macros: { kcal: 143, prot: 12.6, hc: 0.7, grasa: 9.5 },
    sinonimos: ['huevo'] },
  { nombre: 'soja texturizada', categoria: 'proteina', unidad: 'g', rinde: 2.5,
    macros: { kcal: 340, prot: 50, hc: 30, grasa: 1.5 },
    sinonimos: ['proteína de soja', 'soja texturizada fina'] },
  { nombre: 'tofu', categoria: 'proteina', unidad: 'g', rinde: 0.95,
    macros: { kcal: 130, prot: 14, hc: 2, grasa: 7.5 },
    sinonimos: ['tofu firme'] },
];

/* --- Verduras ------------------------------------------------------------ */

/** Al asarse o saltearse pierden agua; las de ensalada no, pero da igual a esta escala. */
const RINDE_VERDURA = 0.9;

function verdura(
  nombre: string,
  kcal: number,
  prot: number,
  hc: number,
  grasa: number,
  sinonimos?: string[],
): Alimento {
  return {
    nombre,
    categoria: 'verdura',
    unidad: 'g',
    rinde: RINDE_VERDURA,
    macros: { kcal, prot, hc, grasa },
    sinonimos,
  };
}

const VERDURAS: Alimento[] = [
  verdura('cebolla', 40, 1.1, 9, 0.1, ['cebollas']),
  verdura('cebolla morada', 40, 1.1, 9, 0.1),
  verdura('puerro', 61, 1.5, 14, 0.3, ['puerros']),
  verdura('tomate', 18, 0.9, 3.9, 0.2, ['tomates', 'tomate pera']),
  verdura('tomate cherry', 18, 0.9, 3.9, 0.2, ['tomates cherry']),
  verdura('pimiento rojo', 31, 1, 6, 0.3, ['pimientos rojos']),
  verdura('pimiento verde', 20, 0.9, 4.6, 0.2, ['pimientos verdes', 'pimiento italiano']),
  verdura('calabacín', 17, 1.2, 3.1, 0.3, ['calabacines']),
  verdura('berenjena', 25, 1, 6, 0.2, ['berenjenas']),
  verdura('brócoli', 34, 2.8, 7, 0.4, ['brocoli', 'ramilletes de brócoli']),
  verdura('coliflor', 25, 1.9, 5, 0.3),
  verdura('judías verdes', 31, 1.8, 7, 0.1, ['judia verde', 'vainas']),
  verdura('espinacas', 23, 2.9, 3.6, 0.4, ['espinaca', 'espinacas frescas']),
  verdura('acelgas', 19, 1.8, 3.7, 0.2),
  verdura('kale', 49, 4.3, 9, 0.9, ['col rizada']),
  verdura('zanahoria', 41, 0.9, 10, 0.2, ['zanahorias']),
  verdura('guisantes', 81, 5.4, 14, 0.4),
  verdura('champiñones', 22, 3.1, 3.3, 0.3, ['champiñón', 'champiñones laminados']),
  verdura('setas', 28, 2.5, 5, 0.3, ['setas variadas', 'shiitake', 'níscalos']),
  verdura('calabaza', 26, 1, 6.5, 0.1),
  verdura('alcachofas', 47, 3.3, 11, 0.2, ['alcachofa', 'corazones de alcachofa']),
  verdura('espárragos verdes', 20, 2.2, 3.9, 0.1, ['espárragos', 'trigueros', 'esparragos trigueros']),
  verdura('lechuga', 15, 1.4, 2.9, 0.2, ['cogollos', 'lechuga romana']),
  verdura('canónigos', 21, 2, 3.6, 0.4),
  verdura('rúcula', 25, 2.6, 3.7, 0.7),
  verdura('escarola', 17, 1.3, 3.4, 0.2, ['endivias']),
  verdura('pepino', 15, 0.7, 3.6, 0.1, ['pepinos']),
  verdura('apio', 16, 0.7, 3, 0.2),
  verdura('repollo', 25, 1.3, 5.8, 0.1, ['col', 'col blanca', 'lombarda']),
  verdura('coles de Bruselas', 43, 3.4, 9, 0.3),
  verdura('maíz', 86, 3.3, 19, 1.2, ['maíz dulce']),
  verdura('remolacha', 43, 1.6, 10, 0.2),
  verdura('nabo', 28, 0.9, 6.4, 0.1),
  verdura('hinojo', 31, 1.2, 7.3, 0.2),
  verdura('pimientos del piquillo', 30, 1.2, 5.5, 0.3, ['piquillos']),
];

/* --- Hidratos ------------------------------------------------------------ */

const HIDRATOS: Alimento[] = [
  { nombre: 'arroz blanco', categoria: 'hidrato', unidad: 'g', rinde: 2.7,
    macros: { kcal: 355, prot: 7, hc: 78, grasa: 0.8 },
    sinonimos: ['arroz', 'arroz basmati', 'arroz largo'] },
  { nombre: 'pasta', categoria: 'hidrato', unidad: 'g', rinde: 2.4,
    macros: { kcal: 360, prot: 12.5, hc: 71, grasa: 1.8 },
    sinonimos: ['pasta de trigo', 'macarrones', 'espaguetis', 'penne', 'fusilli', 'tallarines'] },
  { nombre: 'fideos de arroz', categoria: 'hidrato', unidad: 'g', rinde: 2.6,
    macros: { kcal: 360, prot: 6, hc: 82, grasa: 0.6 },
    sinonimos: ['noodles de arroz', 'fideos'] },
  { nombre: 'patata', categoria: 'hidrato', unidad: 'g', rinde: 0.95,
    macros: { kcal: 77, prot: 2, hc: 17, grasa: 0.1 },
    sinonimos: ['patatas'] },
  { nombre: 'boniato', categoria: 'hidrato', unidad: 'g', rinde: 0.95,
    macros: { kcal: 86, prot: 1.6, hc: 20, grasa: 0.1 },
    sinonimos: ['batata'] },
  { nombre: 'ñoquis', categoria: 'hidrato', unidad: 'g', rinde: 1,
    macros: { kcal: 155, prot: 4, hc: 32, grasa: 0.9 },
    sinonimos: ['gnocchi', 'noquis'] },
  { nombre: 'pan', categoria: 'hidrato', unidad: 'g', rinde: 1,
    macros: { kcal: 260, prot: 8.5, hc: 49, grasa: 3 },
    sinonimos: ['pan de barra', 'chapata', 'pan rústico'] },
  { nombre: 'puré de patata', categoria: 'hidrato', unidad: 'g', rinde: 5,
    macros: { kcal: 355, prot: 8, hc: 75, grasa: 1.5 },
    sinonimos: ['copos de patata', 'pure de patata'] },
  { nombre: 'cuscús', categoria: 'hidrato', unidad: 'g', rinde: 2.8,
    macros: { kcal: 375, prot: 12.8, hc: 72, grasa: 0.6 },
    sinonimos: ['cous cous', 'couscous'] },
  { nombre: 'quinoa', categoria: 'hidrato', unidad: 'g', rinde: 2.8,
    macros: { kcal: 368, prot: 14, hc: 64, grasa: 6 } },
  { nombre: 'tortillas de trigo', categoria: 'hidrato', unidad: 'ud', rinde: 1, gramosPorUnidad: 40,
    macros: { kcal: 300, prot: 8, hc: 50, grasa: 7 },
    sinonimos: ['tortillas de fajita', 'wraps'] },
];

/* --- Salsas -------------------------------------------------------------- */

/** Las salsas llevan racion fija: no se reparten por porcentaje del plato. */
const SALSAS: Alimento[] = [
  { nombre: 'tomate frito', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 80,
    macros: { kcal: 95, prot: 1.7, hc: 11, grasa: 4.4 },
    sinonimos: ['salsa de tomate', 'tomate triturado'] },
  { nombre: 'salsa de soja', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 20,
    macros: { kcal: 55, prot: 8, hc: 5, grasa: 0 },
    sinonimos: ['soja'] },
  { nombre: 'salsa teriyaki', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 30,
    macros: { kcal: 180, prot: 4, hc: 40, grasa: 0 },
    sinonimos: ['teriyaki'] },
  { nombre: 'leche de coco', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 80,
    macros: { kcal: 195, prot: 2, hc: 3.5, grasa: 19 } },
  { nombre: 'pesto', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 25,
    macros: { kcal: 460, prot: 8, hc: 6, grasa: 46 } },
  { nombre: 'yogur griego', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 60,
    macros: { kcal: 115, prot: 8, hc: 4, grasa: 8 },
    sinonimos: ['salsa de yogur'] },
  { nombre: 'nata para cocinar', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 60,
    macros: { kcal: 195, prot: 2.5, hc: 3.5, grasa: 19 },
    sinonimos: ['nata'] },
  { nombre: 'crema de cacahuete', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 25,
    macros: { kcal: 590, prot: 25, hc: 20, grasa: 48 },
    sinonimos: ['mantequilla de cacahuete', 'salsa de cacahuete'] },
  { nombre: 'salsa barbacoa', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 30,
    macros: { kcal: 170, prot: 1, hc: 40, grasa: 0.4 },
    sinonimos: ['barbacoa', 'bbq'] },
  { nombre: 'queso crema', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 40,
    macros: { kcal: 250, prot: 6, hc: 4, grasa: 24 },
    sinonimos: ['philadelphia'] },
  { nombre: 'chimichurri', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 20,
    macros: { kcal: 450, prot: 1.5, hc: 5, grasa: 47 } },
  { nombre: 'pasta de curry', categoria: 'salsa', unidad: 'g', rinde: 1, racion: 25,
    macros: { kcal: 120, prot: 3, hc: 15, grasa: 5 },
    sinonimos: ['curry rojo', 'curry tailandés'] },
  { nombre: 'caldo de verduras', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 200,
    macros: { kcal: 6, prot: 0.3, hc: 1, grasa: 0.1 },
    sinonimos: ['caldo', 'caldo de pollo'] },
  { nombre: 'vino blanco', categoria: 'salsa', unidad: 'ml', rinde: 1, racion: 60,
    macros: { kcal: 82, prot: 0.1, hc: 2.6, grasa: 0 } },
];

/* --- Extras -------------------------------------------------------------- */

const EXTRAS: Alimento[] = [
  { nombre: 'aguacate', categoria: 'extra', unidad: 'ud', rinde: 1, gramosPorUnidad: 140, racion: 70,
    macros: { kcal: 160, prot: 2, hc: 8.5, grasa: 15 } },
  { nombre: 'queso feta', categoria: 'extra', unidad: 'g', rinde: 1, racion: 40,
    macros: { kcal: 264, prot: 14, hc: 4, grasa: 21 } },
  { nombre: 'queso parmesano', categoria: 'extra', unidad: 'g', rinde: 1, racion: 20,
    macros: { kcal: 400, prot: 36, hc: 4, grasa: 27 },
    sinonimos: ['parmesano', 'grana padano'] },
  { nombre: 'mozzarella', categoria: 'extra', unidad: 'g', rinde: 1, racion: 50,
    macros: { kcal: 280, prot: 22, hc: 3, grasa: 20 } },
  { nombre: 'queso rallado', categoria: 'extra', unidad: 'g', rinde: 1, racion: 30,
    macros: { kcal: 400, prot: 25, hc: 2, grasa: 33 } },
  { nombre: 'nueces', categoria: 'extra', unidad: 'g', rinde: 1, racion: 20,
    macros: { kcal: 654, prot: 15, hc: 14, grasa: 65 } },
  { nombre: 'anacardos', categoria: 'extra', unidad: 'g', rinde: 1, racion: 20,
    macros: { kcal: 553, prot: 18, hc: 30, grasa: 44 } },
  { nombre: 'piñones', categoria: 'extra', unidad: 'g', rinde: 1, racion: 15,
    macros: { kcal: 673, prot: 14, hc: 13, grasa: 68 } },
  { nombre: 'aceitunas', categoria: 'extra', unidad: 'g', rinde: 1, racion: 30,
    macros: { kcal: 145, prot: 1, hc: 4, grasa: 15 } },
  { nombre: 'encurtidos', categoria: 'extra', unidad: 'g', rinde: 1, racion: 30,
    macros: { kcal: 20, prot: 0.5, hc: 3, grasa: 0.2 },
    sinonimos: ['pepinillos'] },
  { nombre: 'hummus', categoria: 'extra', unidad: 'g', rinde: 1, racion: 40,
    macros: { kcal: 165, prot: 7.5, hc: 14, grasa: 9 } },
  { nombre: 'semillas de sésamo', categoria: 'extra', unidad: 'g', rinde: 1, racion: 10,
    macros: { kcal: 573, prot: 17, hc: 23, grasa: 50 },
    sinonimos: ['sésamo'] },
  { nombre: 'pipas de calabaza', categoria: 'extra', unidad: 'g', rinde: 1, racion: 15,
    macros: { kcal: 559, prot: 30, hc: 11, grasa: 49 } },
  { nombre: 'cebolla crujiente', categoria: 'extra', unidad: 'g', rinde: 1, racion: 10,
    macros: { kcal: 500, prot: 6, hc: 40, grasa: 34 } },
  { nombre: 'pan rallado', categoria: 'extra', unidad: 'g', rinde: 1, racion: 25,
    macros: { kcal: 350, prot: 12, hc: 68, grasa: 4 },
    sinonimos: ['panko'] },
];

/* --- Aliños y especias --------------------------------------------------- */

/**
 * Van marcados como basicos: cuentan poco en macros y no tienen que ensuciar la
 * lista de la compra, que es justo lo que se pidio desde el principio.
 */
const ALINOS: Alimento[] = [
  'ajo',
  'pimentón dulce',
  'pimentón picante',
  'comino',
  'curry en polvo',
  'cúrcuma',
  'jengibre',
  'orégano',
  'tomillo',
  'romero',
  'hierbas provenzales',
  'albahaca',
  'perejil',
  'cilantro',
  'laurel',
  'guindilla',
  'ajo en polvo',
  'cebolla en polvo',
  'ras el hanout',
  'garam masala',
  'zumo de limón',
  'vinagre balsámico',
  'mostaza de Dijon',
  'miel',
  'sriracha',
].map((nombre): Alimento => ({
  nombre,
  categoria: 'aliño',
  unidad: 'g',
  rinde: 1,
  racion: 0,
  basico: true,
  macros: { kcal: 0, prot: 0, hc: 0, grasa: 0 },
}));

/* --- Grasas de cocinado -------------------------------------------------- */

/**
 * El aceite no va a la compra (esta en la despensa por defecto) pero SI cuenta
 * en calorias: una cucharada son casi 90 kcal y omitirlo falsea el plato entero.
 */
const GRASAS: Alimento[] = [
  { nombre: 'aceite de oliva', categoria: 'grasa', unidad: 'ml', rinde: 1, basico: true,
    macros: { kcal: 884, prot: 0, hc: 0, grasa: 100 },
    sinonimos: ['aceite', 'aceite de oliva virgen extra', 'aove'] },
  { nombre: 'mantequilla', categoria: 'grasa', unidad: 'g', rinde: 1, racion: 15,
    macros: { kcal: 717, prot: 0.9, hc: 0.1, grasa: 81 } },
];

export const ALIMENTOS: Alimento[] = [
  ...PROTEINAS,
  ...VERDURAS,
  ...HIDRATOS,
  ...SALSAS,
  ...EXTRAS,
  ...ALINOS,
  ...GRASAS,
];

export function porCategoria(cat: Categoria): Alimento[] {
  return ALIMENTOS.filter((a) => a.categoria === cat);
}
