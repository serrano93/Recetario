import { describe, expect, it } from 'vitest';
import type { Gasto } from '../types.js';
import { formatearEuros, liquidacion, resumenGastos } from './gastos.js';

const PERSONAS = ['javi', 'andrea'];

function gasto(over: Partial<Gasto> & { cantidad: number }): Gasto {
  return {
    id: 'g1',
    fecha: '2026-08-30',
    concepto: 'Prueba',
    pagadoPor: 'javi',
    imputadoA: ['javi', 'andrea'],
    ...over,
  };
}

/** Atajo: quien debe a quien (o null) para una lista de gastos. */
function deuda(...gastos: Gasto[]) {
  return resumenGastos(gastos, PERSONAS).deuda;
}

describe('balance de gastos', () => {
  it('Javi paga 100 de un gasto compartido -> Andrea le debe 50 (el caso del super)', () => {
    const d = deuda(gasto({ cantidad: 100, pagadoPor: 'javi', imputadoA: ['javi', 'andrea'] }));
    expect(d).toEqual({ deudor: 'andrea', acreedor: 'javi', cantidad: 50 });
  });

  it('Andrea paga un gasto compartido -> Javi le debe la mitad', () => {
    const d = deuda(gasto({ cantidad: 80, pagadoPor: 'andrea', imputadoA: ['javi', 'andrea'] }));
    expect(d).toEqual({ deudor: 'javi', acreedor: 'andrea', cantidad: 40 });
  });

  it('pagado de la conjunta y compartido -> nadie debe nada', () => {
    expect(deuda(gasto({ cantidad: 100, pagadoPor: 'conjunta', imputadoA: ['javi', 'andrea'] }))).toBeNull();
  });

  it('cada uno paga lo suyo -> nadie debe nada', () => {
    expect(deuda(gasto({ cantidad: 30, pagadoPor: 'javi', imputadoA: ['javi'] }))).toBeNull();
    expect(deuda(gasto({ cantidad: 25, pagadoPor: 'andrea', imputadoA: ['andrea'] }))).toBeNull();
  });

  it('Javi paga un gasto solo de Andrea -> Andrea le debe el importe entero', () => {
    const d = deuda(gasto({ cantidad: 30, pagadoPor: 'javi', imputadoA: ['andrea'] }));
    expect(d).toEqual({ deudor: 'andrea', acreedor: 'javi', cantidad: 30 });
  });

  it('Andrea paga un gasto solo de Javi -> Javi le debe el importe entero', () => {
    const d = deuda(gasto({ cantidad: 25, pagadoPor: 'andrea', imputadoA: ['javi'] }));
    expect(d).toEqual({ deudor: 'javi', acreedor: 'andrea', cantidad: 25 });
  });

  it('de la conjunta pero solo de Javi -> Javi debe a Andrea la mitad', () => {
    const d = deuda(gasto({ cantidad: 20, pagadoPor: 'conjunta', imputadoA: ['javi'] }));
    expect(d).toEqual({ deudor: 'javi', acreedor: 'andrea', cantidad: 10 });
  });

  it('de la conjunta pero solo de Andrea -> Andrea debe a Javi la mitad', () => {
    const d = deuda(gasto({ cantidad: 20, pagadoPor: 'conjunta', imputadoA: ['andrea'] }));
    expect(d).toEqual({ deudor: 'andrea', acreedor: 'javi', cantidad: 10 });
  });

  it('varios gastos en los dos sentidos se cancelan', () => {
    const d = deuda(
      gasto({ id: 'a', cantidad: 100, pagadoPor: 'javi', imputadoA: ['javi', 'andrea'] }),
      gasto({ id: 'b', cantidad: 80, pagadoPor: 'andrea', imputadoA: ['javi', 'andrea'] }),
    );
    expect(d).toEqual({ deudor: 'andrea', acreedor: 'javi', cantidad: 10 });
  });

  it('un gasto que se cancela exacto deja la deuda a cero', () => {
    const d = deuda(
      gasto({ id: 'a', cantidad: 40, pagadoPor: 'javi', imputadoA: ['javi', 'andrea'] }),
      gasto({ id: 'b', cantidad: 40, pagadoPor: 'andrea', imputadoA: ['javi', 'andrea'] }),
    );
    expect(d).toBeNull();
  });

  it('sin gastos no hay deuda y los aportes son cero', () => {
    const r = resumenGastos([], PERSONAS);
    expect(r.deuda).toBeNull();
    expect(r.aportes.porPersona).toEqual({ javi: 0, andrea: 0 });
    expect(r.aportes.conjunta).toBe(0);
  });

  it('los centimos se redondean al centimo mas cercano', () => {
    // 1001 centimos a medias: 500,5 -> 5,01 (no 5,005 ni 5,00)
    const d = deuda(gasto({ cantidad: 10.01, pagadoPor: 'conjunta', imputadoA: ['javi'] }));
    expect(d).toEqual({ deudor: 'javi', acreedor: 'andrea', cantidad: 5.01 });
    // 333 centimos a medias: 166,5 -> 1,67
    const d2 = deuda(gasto({ cantidad: 3.33, pagadoPor: 'javi', imputadoA: ['javi', 'andrea'] }));
    expect(d2).toEqual({ deudor: 'andrea', acreedor: 'javi', cantidad: 1.67 });
  });

  it('gente que ya no existe no puede deber ni cobrar', () => {
    const r = resumenGastos(
      [gasto({ cantidad: 10, pagadoPor: 'fantasma', imputadoA: ['javi', 'andrea'] })],
      PERSONAS,
    );
    expect(r.deuda).toBeNull();
    // Un gasto pagado por alguien valido pero imputado a un fantasma: no cuenta.
    const r2 = resumenGastos([gasto({ cantidad: 10, pagadoPor: 'javi', imputadoA: ['fantasma'] })], PERSONAS);
    expect(r2.deuda).toBeNull();
  });

  it('cantidades invalidas se ignoran sin romper nada', () => {
    expect(deuda(gasto({ cantidad: 0 }))).toBeNull();
    expect(deuda(gasto({ cantidad: -5 }))).toBeNull();
  });

  it('los aportes suman lo pagado por cada uno y por la conjunta', () => {
    const r = resumenGastos(
      [
        gasto({ id: 'a', cantidad: 100, pagadoPor: 'javi' }),
        gasto({ id: 'b', cantidad: 40.5, pagadoPor: 'andrea' }),
        gasto({ id: 'c', cantidad: 200, pagadoPor: 'conjunta' }),
      ],
      PERSONAS,
    );
    expect(r.aportes.porPersona.javi).toBe(100);
    expect(r.aportes.porPersona.andrea).toBe(40.5);
    expect(r.aportes.conjunta).toBe(200);
  });
});

describe('liquidacion ("hacer cuentas")', () => {
  it('devuelve el gasto que cancela la deuda pendiente', () => {
    const previos = [gasto({ cantidad: 100, pagadoPor: 'javi', imputadoA: ['javi', 'andrea'] })];
    const ajuste = liquidacion(previos, PERSONAS);
    expect(ajuste).toEqual({
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      concepto: 'Hacer cuentas',
      cantidad: 50,
      pagadoPor: 'andrea',
      imputadoA: ['javi'],
      ajuste: true,
    });
    // Apuntado el ajuste, el balance queda en cero.
    const final = resumenGastos(
      [...previos, { id: 'liq', ...ajuste } as Gasto],
      PERSONAS,
    );
    expect(final.deuda).toBeNull();
  });

  it('con balance a cero no propone nada', () => {
    expect(liquidacion([], PERSONAS)).toBeNull();
  });
});

describe('formatearEuros', () => {
  it('formatea con coma y dos decimales', () => {
    expect(formatearEuros(50)).toBe('50,00 €');
    expect(formatearEuros(12.5)).toBe('12,50 €');
    expect(formatearEuros(0.1)).toBe('0,10 €');
  });
});
