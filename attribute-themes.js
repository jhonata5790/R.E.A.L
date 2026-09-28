// Centros em porcentagem do PNG quadrado. As artes têm a mesma composição,
// mas os círculos variam ligeiramente entre as classes.
const ATTRIBUTE_WHEEL_CENTERS = {
    neutral: { agilidade: [49.92, 19.94], forca: [20.97, 40.27], intelecto: [78.95, 40.27], presenca: [29.67, 74.56], vigor: [70.33, 74.56] },
    combatente: { agilidade: [50, 20], forca: [21, 40.7], intelecto: [79, 40.7], presenca: [29.7, 74.6], vigor: [70.3, 74.6] },
    ocultista: { agilidade: [50, 20], forca: [21.2, 40.3], intelecto: [78.8, 40.3], presenca: [30.5, 74.8], vigor: [69.5, 74.8] },
    especialista: { agilidade: [50, 17.7], forca: [21.4, 39.9], intelecto: [78.6, 39.9], presenca: [29.1, 75.4], vigor: [70.9, 75.4] },
    mundano: { agilidade: [50, 18.5], forca: [18.5, 40], intelecto: [81.5, 40], presenca: [29.8, 75.4], vigor: [70.2, 75.4] }
};

// Compartilhado com qualquer página que exiba a roda de atributos.
window.REAL_ATTRIBUTE_THEMES = Object.freeze({
    neutral: {
        label: "Classe ainda não definida",
        image: "assets/atributos-indefinido.png",
        centers: ATTRIBUTE_WHEEL_CENTERS.neutral,
        valueTop: { agilidade: 20 },
        accent: "#c7c5c1",
        accentLight: "#e8e5df",
        accentInk: "#202023",
        accentRgb: "199, 197, 193",
        border: "#49494e",
        glow: "#75777b33"
    },
    combatente: {
        label: "Classe: Combatente",
        image: "assets/atributos-combatente.png",
        centers: ATTRIBUTE_WHEEL_CENTERS.combatente,
        valueTop: { agilidade: 20 },
        accent: "#da7777",
        accentLight: "#ffbfc0",
        accentInk: "#2b1013",
        accentRgb: "218, 119, 119",
        border: "#694145",
        glow: "#883c443d"
    },
    ocultista: {
        label: "Classe: Ocultista",
        image: "assets/atributos-ocultista.png",
        centers: ATTRIBUTE_WHEEL_CENTERS.ocultista,
        valueTop: { agilidade: 24 },
        accent: "#a98bd1",
        accentLight: "#dfccff",
        accentInk: "#24152d",
        accentRgb: "169, 139, 209",
        border: "#594668",
        glow: "#6f4a8e40"
    },
    especialista: {
        label: "Classe: Especialista",
        image: "assets/atributos-especialista.png",
        centers: ATTRIBUTE_WHEEL_CENTERS.especialista,
        valueTop: { agilidade: 24 },
        accent: "#89bda1",
        accentLight: "#d3f0dd",
        accentInk: "#14291e",
        accentRgb: "137, 189, 161",
        border: "#41604e",
        glow: "#3c79583d"
    },
    mundano: {
        label: "Classe: Mundano",
        image: "assets/atributos-mundano.png",
        centers: ATTRIBUTE_WHEEL_CENTERS.mundano,
        valueTop: { agilidade: 24 },
        accent: "#a1a4a9",
        accentLight: "#e2e3e5",
        accentInk: "#17191c",
        accentRgb: "161, 164, 169",
        border: "#53575d",
        glow: "#555b6340"
    }
});
