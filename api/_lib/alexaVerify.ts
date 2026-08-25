import { X509Certificate, createVerify } from 'node:crypto';
import { marcaDeTiempoValida, urlCertificadoValida } from '../../src/lib/alexa.js';

export { marcaDeTiempoValida, urlCertificadoValida };

/**
 * Verificacion de que una peticion viene de verdad de Amazon.
 *
 * Sin esto el endpoint queda abierto: cualquiera que descubra la URL podria
 * apuntar cosas en la compra o decir que nadie come en casa. Amazon firma cada
 * peticion y aqui se comprueba la firma contra el cuerpo CRUDO, byte a byte.
 */

const SAN_ESPERADO = 'echo-api.amazon.com';

export class FirmaInvalida extends Error {
  constructor(motivo: string) {
    super(`Firma de Alexa no valida: ${motivo}`);
    this.name = 'FirmaInvalida';
  }
}

/** Parte el PEM en los certificados de la cadena, del hoja a la raiz. */
export function partirCadena(pem: string): X509Certificate[] {
  const bloques = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
  return bloques.map((b) => new X509Certificate(b));
}

/** ¿El certificado dice de verdad ser el de Alexa, y sigue vigente? */
export function certificadoUsable(cert: X509Certificate, ahora = new Date()): boolean {
  const sans = (cert.subjectAltName ?? '').split(',').map((s: string) => s.trim().replace(/^DNS:/, ''));
  if (!sans.includes(SAN_ESPERADO)) return false;
  return new Date(cert.validFrom) <= ahora && ahora <= new Date(cert.validTo);
}

/** Cada certificado tiene que estar firmado por el siguiente de la cadena. */
export function cadenaEncadenada(certs: X509Certificate[]): boolean {
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) return false;
  }
  return true;
}

const cache = new Map<string, X509Certificate[]>();

/**
 * Comprueba la firma de una peticion.
 *
 * `cuerpo` tiene que ser el cuerpo crudo tal cual llego: si se parsea y se
 * vuelve a serializar, cambia algun byte y la firma deja de cuadrar.
 */
export async function verificarPeticion(
  cuerpo: Buffer,
  cabeceras: Record<string, string | string[] | undefined>,
  ahora = new Date(),
): Promise<void> {
  const leer = (n: string) => {
    const v = cabeceras[n] ?? cabeceras[n.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  // Amazon manda SHA-256 desde hace tiempo; SHA-1 sigue por compatibilidad.
  const firma256 = leer('signature-256');
  const firma1 = leer('signature');
  const firma = firma256 ?? firma1;
  const algoritmo = firma256 ? 'RSA-SHA256' : 'RSA-SHA1';
  const urlCert = leer('signaturecertchainurl');

  if (!firma || !urlCert) throw new FirmaInvalida('faltan las cabeceras de firma');
  if (!urlCertificadoValida(urlCert)) throw new FirmaInvalida('la URL del certificado no es de Amazon');

  let certs = cache.get(urlCert);
  if (!certs) {
    const res = await fetch(urlCert);
    if (!res.ok) throw new FirmaInvalida(`no se pudo descargar el certificado (${res.status})`);
    certs = partirCadena(await res.text());
    if (certs.length === 0) throw new FirmaInvalida('el certificado venia vacio');
    cache.set(urlCert, certs);
  }

  const hoja = certs[0];
  if (!certificadoUsable(hoja, ahora)) throw new FirmaInvalida('el certificado no vale para Alexa o ha caducado');
  if (!cadenaEncadenada(certs)) throw new FirmaInvalida('la cadena de certificados no encaja');

  const verificador = createVerify(algoritmo);
  verificador.update(cuerpo);
  if (!verificador.verify(hoja.publicKey, firma, 'base64')) {
    throw new FirmaInvalida('la firma no corresponde al cuerpo');
  }
}
