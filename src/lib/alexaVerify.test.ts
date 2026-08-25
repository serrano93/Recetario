import { describe, expect, it } from 'vitest';
import { marcaDeTiempoValida, urlCertificadoValida } from './alexa.js';

/**
 * La verificacion de firma es lo unico que impide que cualquiera que descubra
 * la URL escriba en el recetario, asi que interesa comprobar sobre todo que
 * RECHAZA lo que tiene que rechazar.
 */

describe('urlCertificadoValida', () => {
  it('acepta la ruta real de Amazon', () => {
    expect(urlCertificadoValida('https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem')).toBe(true);
    expect(urlCertificadoValida('https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem')).toBe(true);
  });

  it('rechaza otro dominio, aunque lo parezca', () => {
    expect(urlCertificadoValida('https://s3.amazonaws.com.malo.com/echo.api/x.pem')).toBe(false);
    expect(urlCertificadoValida('https://malo.com/echo.api/x.pem')).toBe(false);
  });

  it('rechaza sin https', () => {
    expect(urlCertificadoValida('http://s3.amazonaws.com/echo.api/x.pem')).toBe(false);
  });

  it('rechaza otra ruta del mismo bucket', () => {
    // Cualquiera puede subir a S3; solo /echo.api/ es de Amazon.
    expect(urlCertificadoValida('https://s3.amazonaws.com/otra/x.pem')).toBe(false);
  });

  it('no se deja escapar de la ruta con ..', () => {
    expect(urlCertificadoValida('https://s3.amazonaws.com/echo.api/../subido-por-mi/x.pem')).toBe(false);
  });

  it('rechaza un puerto raro', () => {
    expect(urlCertificadoValida('https://s3.amazonaws.com:8080/echo.api/x.pem')).toBe(false);
  });

  it('rechaza basura', () => {
    expect(urlCertificadoValida('no soy una url')).toBe(false);
    expect(urlCertificadoValida('')).toBe(false);
  });
});

describe('marcaDeTiempoValida', () => {
  const ahora = Date.parse('2026-08-25T12:00:00Z');

  it('acepta lo reciente', () => {
    expect(marcaDeTiempoValida('2026-08-25T11:59:30Z', ahora)).toBe(true);
  });

  it('rechaza lo viejo: es lo que frena reenviar una peticion capturada', () => {
    expect(marcaDeTiempoValida('2026-08-25T11:55:00Z', ahora)).toBe(false);
  });

  it('rechaza lo que viene del futuro', () => {
    expect(marcaDeTiempoValida('2026-08-25T12:10:00Z', ahora)).toBe(false);
  });

  it('rechaza si falta o no se entiende', () => {
    expect(marcaDeTiempoValida(undefined, ahora)).toBe(false);
    expect(marcaDeTiempoValida('ayer por la tarde', ahora)).toBe(false);
  });
});

