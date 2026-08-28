import { describe, expect, it } from 'vitest';
import { SECCIONES, agruparPorSeccion, seccionDe } from './secciones.js';

describe('seccionDe', () => {
  it('manda cada cosa a su mostrador', () => {
    expect(seccionDe('contramuslo de pollo')).toBe('carne');
    expect(seccionDe('salmón')).toBe('pescado');
    expect(seccionDe('gambas')).toBe('pescado');
    expect(seccionDe('brócoli')).toBe('verduras');
    expect(seccionDe('arroz blanco')).toBe('despensa');
    expect(seccionDe('huevos')).toBe('refrigerados');
    expect(seccionDe('queso parmesano')).toBe('refrigerados');
  });

  it('manda el pasillo, no el animal', () => {
    // El atun fresco esta en la pescaderia; el de lata, en conservas.
    expect(seccionDe('atún')).toBe('pescado');
    expect(seccionDe('atún en lata')).toBe('despensa');
    // La soja texturizada viene seca en una bolsa.
    expect(seccionDe('soja texturizada')).toBe('despensa');
    expect(seccionDe('garbanzos cocidos')).toBe('despensa');
    expect(seccionDe('tofu')).toBe('refrigerados');
  });

  it('la patata esta con las verduras, no con el arroz', () => {
    expect(seccionDe('patata')).toBe('verduras');
    expect(seccionDe('boniato')).toBe('verduras');
  });

  it('el aguacate y el limón van a la frutería', () => {
    expect(seccionDe('aguacate')).toBe('verduras');
    expect(seccionDe('limón')).toBe('verduras');
  });

  it('el chorizo es carne aunque en la receta sea un extra', () => {
    expect(seccionDe('chorizo')).toBe('carne');
  });

  it('la nata y el yogur van al frío; el tomate frito no', () => {
    expect(seccionDe('nata para cocinar')).toBe('refrigerados');
    expect(seccionDe('yogur griego')).toBe('refrigerados');
    expect(seccionDe('tomate frito')).toBe('despensa');
  });

  it('adivina lo que no está en el catálogo por palabras', () => {
    // Los items sueltos que se añaden a mano nunca estan en el catalogo.
    expect(seccionDe('lubina')).toBe('pescado');
    expect(seccionDe('leche entera')).toBe('refrigerados');
    expect(seccionDe('manzanas')).toBe('verduras');
    expect(seccionDe('jamón serrano')).toBe('carne');
  });

  it('lo que no sabe encasillar va a Otros, no a una sección al azar', () => {
    expect(seccionDe('papel de cocina')).toBe('otros');
    expect(seccionDe('bolsas de basura')).toBe('otros');
  });
});

describe('agruparPorSeccion', () => {
  const linea = (name: string) => ({ name });

  it('respeta el orden de recorrido del súper', () => {
    const g = agruparPorSeccion([linea('salmón'), linea('cebolla'), linea('arroz')]);
    expect(g.map((x) => x.seccion.id)).toEqual(['verduras', 'despensa', 'pescado']);
  });

  it('no saca cabeceras vacías', () => {
    const g = agruparPorSeccion([linea('cebolla')]);
    expect(g).toHaveLength(1);
    expect(g[0].seccion.nombre).toBe('Frutería');
  });

  it('no pierde ni duplica nada', () => {
    const nombres = ['pollo', 'salmón', 'cebolla', 'arroz', 'huevos', 'papel de cocina'];
    const g = agruparPorSeccion(nombres.map(linea));
    expect(g.flatMap((x) => x.lineas.map((l) => l.name)).sort()).toEqual([...nombres].sort());
  });

  it('con la lista vacía no devuelve nada', () => {
    expect(agruparPorSeccion([])).toEqual([]);
  });
});

describe('secciones', () => {
  it('todas tienen color propio', () => {
    const colores = SECCIONES.map((s) => s.color);
    expect(new Set(colores).size).toBe(colores.length);
  });
});
