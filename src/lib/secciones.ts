import type { Categoria } from './alimentos.js';
import { buscarAlimento } from './nutricion.js';
import { normalize } from './ingredients.js';

/**
 * En que parte del super esta cada cosa.
 *
 * La lista se ordenaba alfabeticamente, que es comodo para buscar en una
 * pantalla y horrible para comprar: te manda de la carniceria a la fruteria y
 * otra vez a la carniceria. Agrupar por seccion convierte la lista en un
 * recorrido.
 *
 * El orden de SECCIONES es el orden en el que se recorre un supermercado
 * normal: primero lo que no se estropea, y el frio al final.
 */

export type Seccion =
  | 'verduras'
  | 'carne'
  | 'pescado'
  | 'despensa'
  | 'refrigerados'
  | 'otros';

export interface InfoSeccion {
  id: Seccion;
  nombre: string;
  /** Color fijo, no del tema: son etiquetas, no superficie. */
  color: string;
}

export const SECCIONES: InfoSeccion[] = [
  { id: 'verduras', nombre: 'Frutería', color: '#3f7f63' },
  { id: 'despensa', nombre: 'Despensa', color: '#9c7133' },
  { id: 'carne', nombre: 'Carnicería', color: '#b8542f' },
  { id: 'pescado', nombre: 'Pescadería', color: '#3a6f96' },
  { id: 'refrigerados', nombre: 'Refrigerados', color: '#7a5aa8' },
  { id: 'otros', nombre: 'Otros', color: '#7d746a' },
];

/**
 * Proteinas que no van al mostrador de la carne. Lo que manda es donde esta en
 * la tienda, no de que animal salio: el atun en lata esta en el pasillo de
 * conservas, y la soja texturizada viene seca en una bolsa.
 */
const DEL_MAR = ['salmón', 'atún', 'merluza', 'gambas'];
const REFRIGERADO = ['huevos', 'tofu'];
const DE_DESPENSA = [
  'atún en lata',
  'soja texturizada',
  'lentejas',
  'lentejas cocidas',
  'garbanzos cocidos',
  'alubias cocidas',
];

/**
 * Palabras para lo que no esta en el catalogo: los items sueltos que se anaden
 * a mano ("papel de cocina", "cerveza") y cualquier receta escrita libremente.
 */
const PISTAS: { seccion: Seccion; palabras: string[] }[] = [
  { seccion: 'pescado', palabras: ['pescado', 'merluza', 'bacalao', 'lubina', 'dorada', 'boquerones', 'sardinas', 'calamar', 'pulpo', 'mejillones', 'langostino', 'marisco'] },
  { seccion: 'carne', palabras: ['pollo', 'pavo', 'cerdo', 'ternera', 'cordero', 'carne', 'chuleta', 'filete', 'costilla', 'jamón', 'chorizo', 'bacon', 'panceta', 'salchicha', 'longaniza', 'morcilla'] },
  { seccion: 'refrigerados', palabras: ['leche', 'yogur', 'queso', 'nata', 'mantequilla', 'huevo', 'tofu', 'hummus', 'natillas'] },
  { seccion: 'verduras', palabras: ['manzana', 'plátano', 'naranja', 'fresa', 'uva', 'pera', 'melón', 'sandía', 'kiwi', 'fruta', 'ensalada', 'brotes', 'germinados'] },
  { seccion: 'despensa', palabras: ['arroz', 'pasta', 'harina', 'pan', 'galleta', 'cereal', 'conserva', 'lata', 'legumbre', 'garbanzo', 'lenteja', 'alubia', 'aceite', 'vinagre', 'salsa', 'caldo', 'café', 'té', 'azúcar', 'chocolate', 'fruto seco', 'almendra'] },
];

/** De la categoria del catalogo a la seccion del super. */
function porCategoria(categoria: Categoria, nombre: string): Seccion {
  if (categoria === 'verdura') return 'verduras';
  if (categoria === 'proteina') {
    if (DE_DESPENSA.includes(nombre)) return 'despensa';
    if (DEL_MAR.includes(nombre)) return 'pescado';
    if (REFRIGERADO.includes(nombre)) return 'refrigerados';
    return 'carne';
  }
  if (categoria === 'hidrato') {
    // La patata y el boniato estan con las verduras, no con el arroz.
    return nombre === 'patata' || nombre === 'boniato' ? 'verduras' : 'despensa';
  }
  if (categoria === 'extra') {
    if (nombre === 'aguacate' || nombre === 'limón') return 'verduras';
    if (nombre === 'chorizo') return 'carne';
    if (nombre.includes('queso') || nombre === 'mozzarella' || nombre === 'hummus') return 'refrigerados';
    return 'despensa';
  }
  if (categoria === 'salsa') {
    return nombre === 'yogur griego' || nombre === 'nata para cocinar' ? 'refrigerados' : 'despensa';
  }
  return 'despensa';
}

/** A que seccion del super pertenece un ingrediente, por su nombre. */
export function seccionDe(nombre: string): Seccion {
  const alimento = buscarAlimento(nombre);
  if (alimento) return porCategoria(alimento.categoria, alimento.nombre);

  const n = normalize(nombre);
  for (const { seccion, palabras } of PISTAS) {
    if (palabras.some((p) => n.includes(normalize(p)))) return seccion;
  }
  return 'otros';
}

/**
 * Reparte las lineas en secciones, en orden de recorrido.
 * Solo devuelve las secciones que tienen algo: una cabecera vacia es ruido.
 */
export function agruparPorSeccion<T extends { name: string }>(
  lineas: T[],
): { seccion: InfoSeccion; lineas: T[] }[] {
  const porSeccion = new Map<Seccion, T[]>();
  for (const l of lineas) {
    const s = seccionDe(l.name);
    const lista = porSeccion.get(s);
    if (lista) lista.push(l);
    else porSeccion.set(s, [l]);
  }
  return SECCIONES.filter((s) => porSeccion.has(s.id)).map((seccion) => ({
    seccion,
    lineas: porSeccion.get(seccion.id)!,
  }));
}
