import { MAXIMO, PASO, textoValor } from '../lib/valoracion.js';

/**
 * Estrellas de valoracion, con medias.
 *
 * Cada estrella se pinta con un gradiente en vez de con media estrella
 * recortada: asi el mismo dibujo vale para entera, media y vacia, y no hay tres
 * iconos que mantener cuadrados entre si.
 */

const CAMINO = 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

function Estrella({ relleno, size }: { relleno: number; size: number }) {
  // Un id por instancia: dos gradientes con el mismo id se pisan en el DOM.
  const id = `est-${Math.round(relleno * 100)}-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="estrella">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${relleno * 100}%`} stopColor="currentColor" />
          <stop offset={`${relleno * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d={CAMINO}
        fill={relleno > 0 ? `url(#${id})` : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cuanto se rellena la estrella numero `i` para un valor dado. */
function relleno(valor: number, i: number): number {
  return Math.max(0, Math.min(1, valor - i));
}

/** Solo para mirar: en las tarjetas de la lista. */
export function Estrellas({ valor, size = 14 }: { valor: number; size?: number }) {
  return (
    <span className="estrellas" role="img" aria-label={`${textoValor(valor)} de ${MAXIMO}`}>
      {Array.from({ length: MAXIMO }, (_, i) => (
        <Estrella key={i} relleno={relleno(valor, i)} size={size} />
      ))}
    </span>
  );
}

/**
 * Para tocar. Cada estrella son dos mitades: la izquierda pone media y la
 * derecha entera. Volver a tocar el valor que ya esta puesto lo quita, que es
 * la unica forma de deshacer un toque sin un boton aparte.
 */
export function EstrellasEditables({
  valor,
  onChange,
  size = 30,
  etiqueta,
}: {
  valor: number;
  onChange: (v: number) => void;
  size?: number;
  etiqueta: string;
}) {
  const tocar = (v: number) => onChange(v === valor ? 0 : v);

  return (
    <span className="estrellas estrellas-editables" role="group" aria-label={etiqueta}>
      {Array.from({ length: MAXIMO }, (_, i) => {
        const media = i + PASO;
        const entera = i + 1;
        return (
          <span key={i} className="estrella-hueco" style={{ width: size, height: size }}>
            <Estrella relleno={relleno(valor, i)} size={size} />
            <button
              type="button"
              className="mitad mitad-izq"
              aria-label={`${textoValor(media)} estrellas`}
              aria-pressed={valor === media}
              onClick={() => tocar(media)}
            />
            <button
              type="button"
              className="mitad mitad-der"
              aria-label={`${textoValor(entera)} estrellas`}
              aria-pressed={valor === entera}
              onClick={() => tocar(entera)}
            />
          </span>
        );
      })}
    </span>
  );
}
