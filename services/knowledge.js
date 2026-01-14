module.exports = {
  brand: {
    name: "TOWN ART Pole & Spa",
    slogan: "El arte eres tú",
    address: "Calle Gral. Donato Guerra 20, Col. Hogares Marla, C.P. 55020, Ecatepec de Morelos, Edo. Méx.",
    phone: "55 9347 6932",
    whatsapp: "56 3978 1869",
    instagram: "@townartmx",
    facebook: "Town Art"
  },

  hours: {
    general: "Lunes a viernes 9:00–21:00 | Sábado 9:00–14:00 | Domingo cerrado",
    spaRecommended: "Recomendado agendar Spa entre 9:00 y 18:00"
  },

  spa: {
    valuation: { price: 200, durationMin: 30, name: "Consulta de valoración con especialista" },

    facials: [
      { name: "Limpieza facial profunda", price: 1080 },
      { name: "Facial hidratante", price: 1320 },
      { name: "Facial despigmentante", price: 1320 },
      { name: "Lifting facial", price: 1320 },
      { name: "Facial nutrición", price: 1320 },
      { name: "Facial anti acné", price: 1320 },
      { name: "Facial anti aging", price: 1320 }
    ],

    body: [
      { name: "Reductivo por área (abdomen/piernas/espalda baja/espalda alta y brazos)", price: 1500, plan6: 7920 },
      { name: "Lifting de glúteo", price: 1350, plan6: 7128 },
      { name: "Anti celulitis", price: 1300, plan6: 6864 },
      { name: "Anti estrías", price: 900, plan6: 4752 },
      { name: "Despigmentación corporal por área", price: 749 },
      { name: "Depilación corporal por área (varía por zona)", price: null }
    ],

    rules: {
      toleranceMin: 15,
      maxSimultaneous: 2
    }
  },

  academy: {
    classInfo: "Todas las clases duran aprox. 60 min y son multinivel.",
    classes: ["Pole Fitness", "Flying Pole", "Flexi", "Floorwork", "Acrobacia"],
    singleClassPrice: { pole: 190, flying: 210, sample: 100 },

    packages: [
      { name: "DA VINCI", desc: "12 clases mensuales de pole", price: 1260 },
      { name: "FRANK GHERY", desc: "8 clases mensuales de pole", price: 890 },
      { name: "HOUSER", desc: "4 clases mensuales de pole", price: 630 },
      { name: "VAN GOGH", desc: "4 clases mensuales combinadas", price: 735 },
      { name: "MONET", desc: "8 pole + 4 flying al mes", price: 1385 },
      { name: "MIGUEL ÁNGEL", desc: "Todas las clases (incluye 4 flying/mes)", price: 2310 }
    ]
  },

  // Horarios EXACTOS del documento
  poleSchedule: {
    monday: ["11:00", "18:00", "19:00"],                  // Pole Fitness
    tuesday: ["10:00", "11:00", "19:00", "20:15"],        // Flexi 10:00, Pole 11:00, Floorwork 19:00, Pole 20:15
    wednesday: ["11:00", "18:00", "19:00"],               // Pole Fitness
    thursday: ["10:00", "18:00", "19:00", "20:30"],       // Pole 10:00, Flying 18:00, Acro 19:00, Pole 20:30
    friday: ["11:00", "12:30", "18:00", "19:00"],         // Pole 11:00, Flying 12:30, Pole 18:00, Pole 19:00
    saturday: ["10:00", "11:00", "13:00"],                // Pole 10:00, Pole 11:00, Flying 13:00
    sunday: []
  },

  poleScheduleText: [
    "🩰 *Horarios Academia Town Art*",
    "",
    "Lunes → 11:00, 18:00, 19:00 (Pole Fitness)",
    "Martes → 10:00 (Flexi), 11:00 (Pole), 19:00 (Floorwork), 20:15 (Pole)",
    "Miércoles → 11:00, 18:00, 19:00 (Pole Fitness)",
    "Jueves → 10:00 (Pole), 18:00 (Flying), 19:00 (Acrobacia), 20:30 (Pole)",
    "Viernes → 11:00 (Pole), 12:30 (Flying), 18:00 (Pole), 19:00 (Pole)",
    "Sábado → 10:00 (Pole), 11:00 (Pole), 13:00 (Flying)"
  ].join("\n")
};
