import { describe, expect, it } from 'vitest';
import { construirReceta, lista, nombreSugerido, seleccionInicial } from './constructor.js';
import { macrosDeReceta } from './nutricion.js';

const conId = (b: ReturnType<typeof construirReceta>) => ({ ...b, id: 'r' });
const cantidad = (b: ReturnType<typeof construirReceta>, nombre: string) =>
  b.ingredients.find((i) => i.name === nombre);

describe('reparto del plato', () => {
  it('la comida sale con mas proteina y la cena con mas verdura', () => {
    const base = { ...seleccionInicial(), proteinas: ['pechuga de pollo'], verduras: ['brócoli'], hidratos: ['arroz blanco'] };
    const comida = construirReceta({ ...base, slot: 'comida', reparto: { proteina: 50, verdura: 25, hidrato: 25 } });
    const cena = construirReceta({ ...base, slot: 'cena', reparto: { proteina: 25, verdura: 50, hidrato: 25 } });

    expect(cantidad(comida, 'pechuga de pollo')!.qty!).toBeGreaterThan(cantidad(cena, 'pechuga de pollo')!.qty!);
    expect(cantidad(cena, 'brócoli')!.qty!).toBeGreaterThan(cantidad(comida, 'brócoli')!.qty!);
  });

  it('el arroz se pide en crudo, no en cocido', () => {
    // 25 % de un plato de 460 g x2 son 230 g de arroz YA HERVIDO. En crudo es
    // un tercio: sin esta conversion el plato seria una montana de arroz.
    const b = construirReceta({ ...seleccionInicial(), hidratos: ['arroz blanco'], proteinas: [], verduras: [] });
    const arroz = cantidad(b, 'arroz blanco')!;
    expect(arroz.qty).toBeGreaterThan(60);
    expect(arroz.qty).toBeLessThan(120);
  });

  it('reparte a partes iguales dentro de la misma categoria', () => {
    const b = construirReceta({ ...seleccionInicial(), verduras: ['calabacín', 'berenjena'], proteinas: [], hidratos: [] });
    expect(cantidad(b, 'calabacín')!.qty).toBe(cantidad(b, 'berenjena')!.qty);
  });

  it('los porcentajes no tienen que sumar 100: se usa la proporcion', () => {
    const base = { ...seleccionInicial(), proteinas: ['pechuga de pollo'], verduras: ['brócoli'], hidratos: [] };
    const cien = construirReceta({ ...base, reparto: { proteina: 60, verdura: 40, hidrato: 0 } });
    const doscientos = construirReceta({ ...base, reparto: { proteina: 120, verdura: 80, hidrato: 0 } });
    expect(cantidad(cien, 'pechuga de pollo')!.qty).toBe(cantidad(doscientos, 'pechuga de pollo')!.qty);
  });

  it('un reparto todo a cero no divide entre cero', () => {
    const b = construirReceta({ ...seleccionInicial(), proteinas: ['salmón'], reparto: { proteina: 0, verdura: 0, hidrato: 0 } });
    expect(Number.isFinite(cantidad(b, 'salmón')!.qty!)).toBe(true);
  });

  it('doblar comensales dobla las cantidades', () => {
    const base = { ...seleccionInicial(), proteinas: ['lomo de cerdo'], verduras: [], hidratos: [] };
    const uno = construirReceta({ ...base, comensales: 1 });
    const dos = construirReceta({ ...base, comensales: 2 });
    expect(cantidad(dos, 'lomo de cerdo')!.qty).toBeCloseTo(cantidad(uno, 'lomo de cerdo')!.qty! * 2, -1);
    expect(dos.servings).toBe(2);
  });

  it('los huevos salen en unidades enteras', () => {
    const b = construirReceta({ ...seleccionInicial(), proteinas: ['huevos'], verduras: [], hidratos: [] });
    const huevos = cantidad(b, 'huevos')!;
    expect(huevos.unit).toBe('ud');
    expect(Number.isInteger(huevos.qty)).toBe(true);
    expect(huevos.qty).toBeGreaterThanOrEqual(1);
  });

  it('nunca pide cero de nada', () => {
    const b = construirReceta({
      ...seleccionInicial('cena', 1),
      apetito: 'ligero',
      proteinas: ['huevos'],
      verduras: ['rúcula', 'tomate cherry', 'pepino'],
      hidratos: ['pan'],
    });
    for (const i of b.ingredients) {
      if (i.qty !== undefined) expect(i.qty, i.name).toBeGreaterThan(0);
    }
  });
});

describe('salsas, extras y aliños', () => {
  it('llevan racion fija y no entran en el reparto del plato', () => {
    const base = { ...seleccionInicial(), proteinas: ['pechuga de pollo'], salsas: ['pesto'] };
    const normal = construirReceta({ ...base, apetito: 'normal' });
    const hambre = construirReceta({ ...base, apetito: 'hambre' });
    expect(cantidad(normal, 'pesto')!.qty).toBe(cantidad(hambre, 'pesto')!.qty);
    expect(cantidad(hambre, 'pechuga de pollo')!.qty!).toBeGreaterThan(cantidad(normal, 'pechuga de pollo')!.qty!);
  });

  it('las salsas si escalan con los comensales', () => {
    const base = { ...seleccionInicial(), proteinas: ['pechuga de pollo'], salsas: ['tomate frito'] };
    expect(cantidad(construirReceta({ ...base, comensales: 2 }), 'tomate frito')!.qty).toBe(
      cantidad(construirReceta({ ...base, comensales: 1 }), 'tomate frito')!.qty! * 2,
    );
  });

  it('las especias van sin cantidad y marcadas como basicas: no ensucian la compra', () => {
    const b = construirReceta({ ...seleccionInicial(), proteinas: ['pavo'], alinos: ['comino', 'pimentón dulce'] });
    const comino = cantidad(b, 'comino')!;
    expect(comino.basico).toBe(true);
    expect(comino.qty).toBeUndefined();
  });

  it('el aceite de la preparacion cuenta en calorias pero no en la compra', () => {
    const b = construirReceta({ ...seleccionInicial(), preparacion: 'horno', proteinas: ['contramuslo de pollo'] });
    const aceite = cantidad(b, 'aceite de oliva')!;
    expect(aceite.basico).toBe(true);
    expect(aceite.qty).toBeGreaterThan(0);
    expect(macrosDeReceta(conId(b)).total.grasa).toBeGreaterThan(15);
  });

  it('al vapor no se anade aceite', () => {
    const b = construirReceta({ ...seleccionInicial(), preparacion: 'vapor', proteinas: ['merluza'] });
    expect(cantidad(b, 'aceite de oliva')).toBeUndefined();
  });
});

describe('la receta que sale', () => {
  it('trae pasos que nombran lo elegido', () => {
    const b = construirReceta({
      ...seleccionInicial(),
      proteinas: ['contramuslo de pollo'],
      verduras: ['pimiento rojo'],
      hidratos: ['arroz blanco'],
      preparacion: 'horno',
    });
    expect(b.steps).toContain('contramuslo de pollo');
    expect(b.steps).toContain('pimiento rojo');
    expect(b.steps).toContain('arroz blanco');
    expect(b.steps.split('\n').length).toBeGreaterThan(3);
  });

  it('encaja en el momento para el que se hizo', () => {
    expect(construirReceta({ ...seleccionInicial('cena'), proteinas: ['tofu'] }).fits).toEqual(['cena']);
  });

  it('los macros salen creibles para una comida de dos', () => {
    const b = construirReceta({
      ...seleccionInicial('comida', 2),
      proteinas: ['contramuslo de pollo'],
      verduras: ['brócoli'],
      hidratos: ['arroz blanco'],
    });
    const n = macrosDeReceta(conId(b));
    expect(n.cobertura).toBe(1);
    expect(n.porRacion.kcal).toBeGreaterThan(400);
    expect(n.porRacion.kcal).toBeLessThan(1000);
    expect(n.porRacion.prot).toBeGreaterThan(30);
  });

  it('sin nada elegido no revienta, solo sale vacia', () => {
    const b = construirReceta(seleccionInicial());
    expect(b.name).toBe('');
    expect(b.ingredients.filter((i) => i.name !== 'aceite de oliva')).toEqual([]);
  });
});

describe('nombreSugerido', () => {
  it('junta proteina, preparacion y guarnicion', () => {
    expect(
      nombreSugerido({ ...seleccionInicial(), proteinas: ['salmón'], hidratos: ['patata'], preparacion: 'horno' }),
    ).toBe('Salmón al horno con patata');
  });

  it('la ensalada se nombra al reves', () => {
    expect(
      nombreSugerido({ ...seleccionInicial(), proteinas: ['atún en lata'], verduras: ['lechuga', 'tomate'], preparacion: 'ensalada' }),
    ).toBe('Ensalada de lechuga y tomate con atún en lata');
  });

  it('sin proteina se apana con la guarnicion', () => {
    expect(nombreSugerido({ ...seleccionInicial(), verduras: ['calabacín'] })).toBe('Calabacín');
  });
});

describe('lista', () => {
  it('usa la y en el ultimo', () => {
    expect(lista(['a'])).toBe('a');
    expect(lista(['a', 'b'])).toBe('a y b');
    expect(lista(['a', 'b', 'c'])).toBe('a, b y c');
    expect(lista([])).toBe('');
  });
});
