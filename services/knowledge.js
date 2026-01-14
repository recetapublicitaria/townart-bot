module.exports = {
  // ============================================================
  // 🟣 HORARIOS POLE (estructura para validación y lógica)
  // ============================================================
  poleSchedule: {
    monday: ["11:00", "18:00", "19:00"],
    tuesday: ["10:00", "11:00", "19:00", "20:15"],
    wednesday: ["11:00", "18:00", "19:00"],
    thursday: ["10:00", "18:00", "19:00", "20:30"],
    friday: ["11:00", "12:30", "18:00", "19:00"],
    saturday: ["10:00", "11:00", "13:00"],
    sunday: []
  },

  // Texto bonito para que Sofía pueda enviar horarios completos
  poleScheduleText: `
🩰 *Horarios Pole & Artes Aéreas*

• *Lunes:* 11:00, 18:00, 19:00  
• *Martes:* 10:00, 11:00, 19:00, 20:15  
• *Miércoles:* 11:00, 18:00, 19:00  
• *Jueves:* 10:00, 18:00, 19:00, 20:30  
• *Viernes:* 11:00, 12:30, 18:00, 19:00  
• *Sábado:* 10:00, 11:00, 13:00  
`,

  // ============================================================
  // 🟣 SERVICIOS SPA (Estructurado para IA + flujos)
  // ============================================================
  spaServices: {
    faciales: [
      { name: "Limpieza profunda", price: 1080 },
      { name: "Hidratante", price: 1320 },
      { name: "Despigmentante", price: 1320 },
      { name: "Nutrición", price: 1320 },
      { name: "Lifting", price: 1320 },
      { name: "Anti acné", price: 1320 },
      { name: "Anti aging", price: 1320 }
    ],
    corporales: [
      { name: "Reductivo por área", price: 1500 },
      { name: "Lifting de glúteo", price: 1350 },
      { name: "Anti celulitis", price: 1300 },
      { name: "Anti estrías", price: 900 },
      { name: "Drenaje linfático", price: null }, // sin precio fijo
      { name: "Pre y post quirúrgicos", price: null },
      { name: "Despigmentación corporal", price: 749 }
    ],
    valoracion: {
      name: "Valoración con especialista",
      price: 200,
      description:
        "La valoración es esencial para recomendar el mejor tratamiento según tu piel, historial y necesidades. Dura 30 minutos."
    }
  },

  // ============================================================
  // 🟣 ACADEMIA POLE (Estructurado)
  // ============================================================
  poleClasses: {
    types: ["Pole Fitness", "Flying Pole", "Flexi", "Floorwork", "Acrobacia"],
    prices: {
      single: { pole: 190, flying: 210, muestra: 100 },
      packages: {
        4: 630,
        8: 890,
        12: 1260,
        combinado: 735,
        unlimited: 2310
      }
    }
  },

  // ============================================================
  // 🟣 POLÍTICAS
  // ============================================================
  policies: {
    spa: [
      "Tolerancia de 15 minutos.",
      "Si se llega tarde, la duración del servicio puede reducirse.",
      "Valoración recomendada antes de cualquier tratamiento profundo."
    ],
    pole: [
      "Si llega tarde a clase, puede integrarse sin problema.",
      "Las clases son multinivel.",
      "No se requiere experiencia previa."
    ]
  },

  // ============================================================
  // 🟣 TEXTO DESCRIPTIVO COMPLETO (para respuestas humanas)
  // ============================================================
  fullText: `
TOWN ART Pole & Spa es un espacio donde combinamos bienestar, belleza y fuerza.  
Todo con un trato humano, ético y profesional 💜✨.

======================
SPA TOWN ART
======================

Trabajamos con:
• Altos estándares en biocosmética  
• Aparatología de grado médico  
• Protocolos seguros  
• Valoración personalizada de $200 antes de iniciar tratamientos profundos  

FACIALES (60 min aprox):
• Limpieza profunda — $1,080  
• Hidratante — $1,320  
• Despigmentante — $1,320  
• Nutrición — $1,320  
• Lifting — $1,320  
• Anti acné — $1,320  
• Anti aging — $1,320  

CORPORALES:
• Reductivos por área — $1,500  
• Lifting de glúteo — $1,350  
• Anti celulitis — $1,300  
• Anti estrías — $900  
• Drenaje linfático (60–75 min)  
• Pre y post quirúrgicos  
• Despigmentación corporal — $749  

======================
ACADEMIA TOWN ART
======================

Clases multinivel:
• Pole Fitness  
• Flying Pole  
• Flexibilidad  
• Floorwork  
• Acrobacia  

Precios:
• Clase suelta pole — $190  
• Flying — $210  
• Muestra — $100  
• Paquetes — desde $630  
• Plan ilimitado (Miguel Ángel) — $2,310  

======================
POLÍTICAS
======================

SPA:
• Tolerancia 15 min  
• Si llega tarde se ajusta duración  
• Valoración recomendada siempre  

POLE:
• Si llega tarde, entra igual  
• Clases para todos los niveles  
• No ocupas experiencia  

======================

Soni debe hablar como experta, cálida y profesional.    
Usa esta información para orientar, vender y guiar decisiones con cariño.
`
};
