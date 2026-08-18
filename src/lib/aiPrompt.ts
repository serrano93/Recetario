import type { AppData } from '../types';
import { today } from './dates';

/**
 * Instrucciones que acompanan al JSON cuando se lo pasas a una IA.
 *
 * La idea es poder decirle "planifícame la semana" o "añade estas cinco
 * recetas" y que devuelva el mismo documento entero, listo para pegar de vuelta
 * en la pestaña Datos.
 */
export function buildAiPrompt(data: AppData): string {
  const nombres = data.people.map((p) => `${p.name} (id "${p.id}")`).join(' y ');

  return `Eres mi ayudante de cocina. Te paso el JSON completo de nuestro recetario.

Personas: ${nombres}.
Hoy es ${today()}.

REGLAS
- Devuelve SIEMPRE el documento JSON completo y valido, con la misma estructura.
- No cambies los "id" que ya existen. Para cosas nuevas, inventa ids sin espacios.
- Las fechas van en formato YYYY-MM-DD y "slot" solo puede ser "comida" o "cena".
- En "people" de cada comida van los ids de quien la come: los dos ids si es
  compartida, uno solo si cada uno come algo distinto ese dia.
- Los ingredientes son solo los principales. NO incluyas sal, pimienta, aceite,
  vinagre ni especias: eso ya lo tenemos.
- Las cantidades de cada receta son para el numero de raciones que indique
  "servings"; la app las escala sola.
- No expliques nada fuera del JSON: responde unicamente con el bloque JSON.

ESTRUCTURA
{
  "version": 1,
  "people":  [{ "id", "name", "color" }],
  "recipes": [{
     "id", "name",
     "tags": ["rapido", "tupper"],
     "servings": 2,
     "minutes": 30,
     "fits": ["comida"],            // vacio = vale para cualquier momento
     "ingredients": [{ "name": "pechuga de pollo", "qty": 400, "unit": "g" }],
     "steps": "Un paso por linea.",
     "notes": "",
     "favorite": false
  }],
  "plan": [{
     "id", "date": "YYYY-MM-DD", "slot": "comida"|"cena",
     "people": ["javi","andrea"],
     "recipeId": "id de una receta",  // o bien:
     "text": "sobras",                 // texto libre si no hay receta
     "done": false
  }],
  "events": [{                        // planes que no son comidas
     "id", "title": "Andrea de viaje",
     "people": ["andrea"],            // vacio = afecta a los dos
     "from": "YYYY-MM-DD", "to": "YYYY-MM-DD",
     "blocks": ["comida","cena"],     // comidas que no se hacen en casa
     "notes": ""
  }],
  "compra": [{ "id", "name", "qty", "unit" }],   // items sueltos de la compra
  "compradosIds": ["nombres ya tachados"],
  "despensa": ["sal","aceite"],                   // nunca van a la compra
  "updatedAt": "ISO"
}

JSON ACTUAL
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

Cuando termines, devuelve el JSON completo modificado.`;
}
