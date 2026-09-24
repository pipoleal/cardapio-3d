import type { Allergen } from "./schemas/common";

export const ALLERGENS: readonly Allergen[] = [
  "gluten",
  "lactose",
  "milk",
  "egg",
  "peanut",
  "tree_nuts",
  "soy",
  "sesame",
  "fish",
  "shellfish",
  "sulfites",
];

export const ALLERGEN_LABELS: Record<Allergen, { pt: string; en: string; es: string }> = {
  gluten: { pt: "Glúten", en: "Gluten", es: "Gluten" },
  lactose: { pt: "Lactose", en: "Lactose", es: "Lactosa" },
  milk: { pt: "Leite", en: "Milk", es: "Leche" },
  egg: { pt: "Ovo", en: "Egg", es: "Huevo" },
  peanut: { pt: "Amendoim", en: "Peanut", es: "Maní" },
  tree_nuts: { pt: "Castanhas", en: "Tree nuts", es: "Frutos secos" },
  soy: { pt: "Soja", en: "Soy", es: "Soja" },
  sesame: { pt: "Gergelim", en: "Sesame", es: "Sésamo" },
  fish: { pt: "Peixe", en: "Fish", es: "Pescado" },
  shellfish: { pt: "Frutos do mar", en: "Shellfish", es: "Mariscos" },
  sulfites: { pt: "Sulfitos", en: "Sulfites", es: "Sulfitos" },
};
