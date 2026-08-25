import type { AppData } from '../types.js';
import { today } from './dates.js';

/**
 * Instrucciones que acompanan al JSON cuando se lo pasas a una IA.
 *
 * El orden importa: la peticion va repetida al principio y, sobre todo, al
 * final. Con las reglas solo arriba, los chats tienden a contestar el menu
 * bonito en texto y a olvidarse del JSON, que es justo lo que rompe el pegado.
 */
export function buildAiPrompt(data: AppData): string {
  const nombres = data.people.map((p) => `${p.name} (id "${p.id}")`).join(' y ');

  return `Actua como una API, no como un chat. Tu unica salida valida es un bloque
JSON con el documento completo de nuestro recetario, modificado segun lo que te
pida al final.

Personas: ${nombres}.
Hoy es ${today()}.

REGLAS DEL FORMATO
- Devuelve el documento ENTERO, no solo la parte que cambies.
- No cambies los "id" que ya existen. Para lo nuevo, inventa ids sin espacios.
- Las fechas van en YYYY-MM-DD y "slot" solo puede ser "comida" o "cena".
- En "people" de cada comida van los ids de quien la come: los dos ids si es
  compartida, uno solo si cada uno come algo distinto ese dia.
- Ingredientes: solo los principales. NADA de sal, pimienta, aceite, vinagre ni
  especias, que ya los tenemos.
- Las cantidades de cada receta son para las raciones de "servings"; la app las
  escala sola segun cuanta gente coma.
- Nombra los ingredientes en singular y en castellano llano ("pechuga de pollo",
  "arroz", "brocoli", "calabacin"). La app reconoce esos nombres y calcula sola
  las calorias y los macros; con nombres de fantasia no puede.
- Las cantidades de carne, pescado, arroz y pasta van EN CRUDO.
- De referencia, un plato de comida es mas o menos mitad proteina, un cuarto
  verdura y un cuarto hidrato; una cena, mitad verdura y un cuarto de cada.
- "ratings" es lo que le pone cada uno a la receta, de 0,5 a 5 en medias
  estrellas. NO te las inventes: usalas para elegir ("planifica con las que mas
  nos gustan"), y solo cambialas si te lo pido.
- Una comida que se come fuera de casa va con "text" (ej. "Paella en casa de
  mis padres") y sin "recipeId", para que no cuente en la compra.

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
     "favorite": false,
     "ratings": { "javi": 4.5, "andrea": 3 }   // de 0,5 a 5; 0 = sin valorar
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

DOCUMENTO ACTUAL
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

--------------------------------------------------------------------
LO QUE TE PIDO (escribelo tu aqui antes de enviar):

  >>> ESCRIBE AQUI LO QUE QUIERES <<<
  (por ejemplo: "planificame la semana con recetas rapidas y sanas",
   "anade estas cinco recetas: ...", "el jueves ceno fuera")

--------------------------------------------------------------------

COMO TIENE QUE SER TU RESPUESTA

Responde UNICAMENTE con un bloque \`\`\`json que contenga SOLO LO QUE CAMBIA.

No hace falta que repitas el documento entero: la app fusiona lo que le des.
Manda solo las secciones que toques, cada una con sus elementos completos:

\`\`\`json
{
  "recipes": [ ...las recetas nuevas o modificadas... ],
  "plan":    [ ...las comidas nuevas o modificadas... ]
}
\`\`\`

- Para MODIFICAR algo que ya existe, reutiliza su mismo "id".
- Para ANADIR algo, inventa un "id" nuevo.
- Lo que no menciones se queda como esta.

NO escribas el menu en texto ni con emojis. NO hagas listas bonitas. NO expliques
nada antes ni despues. Si te apetece comentar algo, metelo en el campo "notes" de
la receta correspondiente.

Un menu escrito en prosa NO me sirve para nada: la app solo sabe leer el JSON.

Empieza tu respuesta directamente con \`\`\`json y terminala con \`\`\`.`;
}
