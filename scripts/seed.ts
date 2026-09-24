/**
 * Popula o emulador com a loja "demo" (confeitaria): 4 categorias, 10
 * produtos e capas placeholder (ícone simples sobre --color-thumb-1/2/3,
 * ver docs/REFERENCIAS-VISUAIS.md) geradas em public/demo/.
 *
 * Tudo (loja, categorias, produtos, variações) tem nome/descrição em
 * pt/en/es com `i18nStatus: { en: "approved", es: "approved" }` — o
 * cardápio já nasce totalmente traduzido, sem "aprovar tradução" manual
 * (isso é fluxo da Etapa 3, aqui só populamos como se já tivesse sido
 * feito). i18nStatus é por ENTIDADE, não por campo — ver
 * docs/MODELO-DE-DADOS.md, "Traduções".
 *
 * Rodar com os emuladores no ar (npm run emulators, noutro terminal):
 *   npm run seed
 *
 * Idempotente: roda de novo sem duplicar nada (usa `.set()` com IDs fixos).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../src/lib/firebase/admin-app";
import type { Allergen } from "../src/lib/schemas/common";

const TENANT_ID = "demo";

const APPROVED_I18N_STATUS = { en: "approved", es: "approved" } as const;

type LocalizedText = { pt: string; en: string; es: string };

const THUMB_COLORS = ["#EFD9C6", "#F0DDB8", "#E3CFC2"];

const CATEGORY_ICONS: Record<string, string> = {
  brigadeiros: `
    <circle cx="100" cy="112" r="34" fill="#2A1C15" opacity="0.85" />
    <circle cx="72" cy="72" r="4" fill="#2A1C15" opacity="0.55" />
    <circle cx="128" cy="72" r="4" fill="#2A1C15" opacity="0.55" />
    <circle cx="100" cy="58" r="4" fill="#2A1C15" opacity="0.55" />`,
  tortas: `<path d="M100 58 L152 142 L48 142 Z" fill="#2A1C15" opacity="0.85" />`,
  croissants: `<path d="M58 118 C58 78 90 52 132 58 C110 60 90 82 93 110 C96 134 120 144 142 134 C124 154 84 152 64 134 C60 130 58 124 58 118 Z" fill="#2A1C15" opacity="0.85" />`,
  bolos: `
    <rect x="52" y="112" width="96" height="30" rx="6" fill="#2A1C15" opacity="0.85" />
    <rect x="68" y="84" width="64" height="28" rx="6" fill="#2A1C15" opacity="0.7" />
    <rect x="97" y="64" width="6" height="20" fill="#2A1C15" opacity="0.6" />
    <path d="M97 58 q6 -10 0 -18 q-6 8 0 18 Z" fill="#B3261E" />`,
};

function writePlaceholderCover(
  slug: string,
  categoryId: string,
  index: number,
): { url: string; path: string; w: number; h: number } {
  const bg = THUMB_COLORS[index % THUMB_COLORS.length];
  const icon = CATEGORY_ICONS[categoryId] ?? "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="24" fill="${bg}" />
  ${icon}
</svg>
`;

  const dir = path.join(process.cwd(), "public", "demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${slug}.svg`), svg, "utf8");

  // Placeholder estático servido por public/ — nada de Storage real ainda
  // (isso é a Etapa 4, quando o pipeline de captura existir de verdade).
  return { url: `/demo/${slug}.svg`, path: `demo/${slug}.svg`, w: 400, h: 400 };
}

type SeedCategory = { id: string; name: LocalizedText; order: number };

const CATEGORIES: SeedCategory[] = [
  {
    id: "brigadeiros",
    name: { pt: "Brigadeiros", en: "Brigadeiros", es: "Brigadeiros" },
    order: 0,
  },
  { id: "tortas", name: { pt: "Tortas", en: "Pies", es: "Tartas" }, order: 1 },
  { id: "croissants", name: { pt: "Croissants", en: "Croissants", es: "Croissants" }, order: 2 },
  { id: "bolos", name: { pt: "Bolos", en: "Cakes", es: "Pasteles" }, order: 3 },
];

type SeedVariant = { id: string; name: LocalizedText; priceCents: number };

type SeedProduct = {
  id: string;
  categoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  priceCents: number;
  servings?: number;
  allergens: Allergen[];
  mayContain?: Allergen[];
  variants?: SeedVariant[];
  tags?: ("vegan" | "sugar_free" | "gluten_free" | "new" | "bestseller")[];
  available?: boolean;
  fresh?: boolean;
};

const BOX_OF_6: LocalizedText = { pt: "Caixa com 6", en: "Box of 6", es: "Caja de 6" };
const BOX_OF_12: LocalizedText = { pt: "Caixa com 12", en: "Box of 12", es: "Caja de 12" };
const BOX_OF_25: LocalizedText = { pt: "Caixa com 25", en: "Box of 25", es: "Caja de 25" };

const PRODUCTS: SeedProduct[] = [
  {
    id: "brigadeiro-tradicional",
    categoryId: "brigadeiros",
    name: {
      pt: "Brigadeiro tradicional",
      en: "Traditional brigadeiro",
      es: "Brigadeiro tradicional",
    },
    description: {
      pt: "O clássico: chocolate ao leite, feito na hora e enrolado na granulada.",
      en: "Brazil's classic sweet: a milk chocolate fudge truffle, made fresh and rolled in chocolate sprinkles.",
      es: "El clásico dulce brasileño: trufa de chocolate con leche, hecha al momento y cubierta con granulado de chocolate.",
    },
    priceCents: 350,
    allergens: ["milk", "lactose"],
    tags: ["bestseller"],
    variants: [
      { id: "c6", name: BOX_OF_6, priceCents: 1800 },
      { id: "c12", name: BOX_OF_12, priceCents: 3400 },
      { id: "c25", name: BOX_OF_25, priceCents: 6500 },
    ],
  },
  {
    id: "brigadeiro-ninho",
    categoryId: "brigadeiros",
    name: {
      pt: "Brigadeiro de ninho",
      en: "Ninho (milk powder) brigadeiro",
      es: "Brigadeiro de leche ninho",
    },
    description: {
      pt: "Recheio de leite ninho com um brigadeiro de chocolate branco por fora.",
      en: "Creamy milk-powder filling wrapped in a white chocolate brigadeiro shell.",
      es: "Relleno cremoso de leche en polvo cubierto con un brigadeiro de chocolate blanco.",
    },
    priceCents: 400,
    allergens: ["milk", "lactose"],
    variants: [
      { id: "c6", name: BOX_OF_6, priceCents: 2100 },
      { id: "c12", name: BOX_OF_12, priceCents: 3900 },
    ],
  },
  {
    id: "brigadeiro-pistache",
    categoryId: "brigadeiros",
    name: { pt: "Brigadeiro de pistache", en: "Pistachio brigadeiro", es: "Brigadeiro de pistacho" },
    description: {
      pt: "Brigadeiro branco com pistache torrado e moído na hora.",
      en: "White chocolate brigadeiro with freshly toasted, ground pistachio.",
      es: "Brigadeiro de chocolate blanco con pistacho tostado y molido al momento.",
    },
    priceCents: 500,
    allergens: ["milk", "lactose", "tree_nuts"],
    tags: ["new"],
  },
  {
    id: "torta-de-limao",
    categoryId: "tortas",
    name: { pt: "Torta de limão", en: "Lemon pie", es: "Tarta de limón" },
    description: {
      pt: "Massa amanteigada, creme de limão e merengue maçaricado na hora.",
      en: "Buttery crust, tangy lemon custard, and meringue torched to order.",
      es: "Base de masa mantecosa, crema de limón y merengue flambeado al momento.",
    },
    priceCents: 6500,
    servings: 8,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "torta-de-morango",
    categoryId: "tortas",
    name: { pt: "Torta de morango", en: "Strawberry pie", es: "Tarta de fresa" },
    description: {
      pt: "Base de massa amanteigada, creme de confeiteiro e morangos frescos.",
      en: "Buttery crust, vanilla pastry cream, and fresh strawberries.",
      es: "Base de masa mantecosa, crema pastelera y fresas frescas.",
    },
    priceCents: 7000,
    servings: 8,
    allergens: ["gluten", "egg", "milk", "lactose"],
    available: false,
  },
  {
    id: "croissant-doce-chocolate",
    categoryId: "croissants",
    name: {
      pt: "Croissant doce de chocolate",
      en: "Chocolate croissant",
      es: "Croissant de chocolate",
    },
    description: {
      pt: "Massa folhada amanteigada com recheio generoso de chocolate.",
      en: "Buttery flaky pastry with a generous chocolate filling.",
      es: "Masa hojaldrada y mantecosa con un generoso relleno de chocolate.",
    },
    priceCents: 1200,
    allergens: ["gluten", "egg", "milk"],
    fresh: true,
  },
  {
    id: "croissant-doce-de-leite",
    categoryId: "croissants",
    name: {
      pt: "Croissant doce de leite",
      en: "Dulce de leche croissant",
      es: "Croissant de dulce de leche",
    },
    description: {
      pt: "Massa folhada crocante recheada com doce de leite artesanal.",
      en: "Crisp flaky pastry filled with house-made dulce de leche.",
      es: "Masa hojaldrada y crocante rellena de dulce de leche artesanal.",
    },
    priceCents: 1200,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "bolo-de-chocolate",
    categoryId: "bolos",
    name: { pt: "Bolo de chocolate", en: "Chocolate cake", es: "Pastel de chocolate" },
    description: {
      pt: "Massa de chocolate fofinha com cobertura de ganache.",
      en: "Soft chocolate sponge with rich ganache frosting.",
      es: "Bizcocho de chocolate esponjoso con cobertura de ganache.",
    },
    priceCents: 9000,
    servings: 12,
    allergens: ["gluten", "egg", "milk", "lactose"],
    mayContain: ["tree_nuts"],
    tags: ["bestseller"],
    variants: [
      {
        id: "p",
        name: { pt: "P · serve 6", en: "S · serves 6", es: "P · sirve 6" },
        priceCents: 6000,
      },
      {
        id: "m",
        name: { pt: "M · serve 12", en: "M · serves 12", es: "M · sirve 12" },
        priceCents: 9000,
      },
      {
        id: "g",
        name: { pt: "G · serve 20", en: "L · serves 20", es: "G · sirve 20" },
        priceCents: 14000,
      },
    ],
  },
  {
    id: "bolo-red-velvet",
    categoryId: "bolos",
    name: { pt: "Bolo red velvet", en: "Red velvet cake", es: "Pastel red velvet" },
    description: {
      pt: "Massa aveludada com cream cheese, clássico americano.",
      en: "Velvety layers with cream cheese frosting, the American classic.",
      es: "Bizcocho aterciopelado con cobertura de queso crema, el clásico americano.",
    },
    priceCents: 9500,
    servings: 12,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "bolo-cenoura-com-chocolate",
    categoryId: "bolos",
    name: {
      pt: "Bolo de cenoura com cobertura de chocolate",
      en: "Carrot cake with chocolate frosting",
      es: "Pastel de zanahoria con cobertura de chocolate",
    },
    description: {
      pt: "Bolo de cenoura fofinho com cobertura cremosa de chocolate.",
      en: "Soft carrot cake topped with creamy chocolate frosting.",
      es: "Bizcocho de zanahoria esponjoso con cobertura cremosa de chocolate.",
    },
    priceCents: 8500,
    servings: 10,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
];

const TENANT_DESCRIPTION: LocalizedText = {
  pt: "Doces artesanais feitos à mão, todos os dias.",
  en: "Handmade artisan sweets, made fresh every day.",
  es: "Dulces artesanales hechos a mano, todos los días.",
};

const TENANT_OPENING_HOURS: LocalizedText = {
  pt: "Seg a sáb, 9h às 19h",
  en: "Mon–Sat, 9am–7pm",
  es: "Lun a sáb, 9h a 19h",
};

// {produto} e {variacao} são placeholders fixos lidos por lib/whatsapp.ts —
// não traduzir o nome deles, só o texto ao redor.
const TENANT_WHATSAPP_TEMPLATE: LocalizedText = {
  pt: "Olá! Quero encomendar {produto} ({variacao}).",
  en: "Hi! I'd like to order {produto} ({variacao}).",
  es: "¡Hola! Quiero pedir {produto} ({variacao}).",
};

async function seed() {
  console.log(`Seed: tenant "${TENANT_ID}"...`);

  await adminDb.collection("slugs").doc(TENANT_ID).set({
    tenantId: TENANT_ID,
    createdAt: FieldValue.serverTimestamp(),
  });

  await adminDb
    .collection("tenants")
    .doc(TENANT_ID)
    .set({
      slug: TENANT_ID,
      name: "Boa Confeitaria",
      description: TENANT_DESCRIPTION,
      whatsapp: "5511999999999",
      whatsappTemplate: TENANT_WHATSAPP_TEMPLATE,
      // "direct": loja demo é online, CTA normal. Origem presencial
      // (?origem=loja/mesa/vitrine) força "discreet" mesmo assim — ver
      // lib/origin.ts.
      whatsappMode: "direct",
      openingHours: TENANT_OPENING_HOURS,
      i18nStatus: APPROVED_I18N_STATUS,
      locales: ["pt", "en", "es"],
      defaultLocale: "pt",
      theme: { primary: "#9C3D27" },
      ownerUids: [],
      plan: "pilot",
      limits: { modelsPerMonth: 10, products: 50 },
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  for (const category of CATEGORIES) {
    await adminDb
      .collection("tenants")
      .doc(TENANT_ID)
      .collection("categories")
      .doc(category.id)
      .set({
        name: category.name,
        i18nStatus: APPROVED_I18N_STATUS,
        order: category.order,
        active: true,
      });
  }

  for (const [index, product] of PRODUCTS.entries()) {
    const coverImage = writePlaceholderCover(product.id, product.categoryId, index);

    await adminDb
      .collection("tenants")
      .doc(TENANT_ID)
      .collection("products")
      .doc(product.id)
      .set({
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        i18nStatus: APPROVED_I18N_STATUS,
        priceCents: product.priceCents,
        ...(product.servings ? { servings: product.servings } : {}),
        allergens: product.allergens,
        ...(product.mayContain ? { mayContain: product.mayContain } : {}),
        ...(product.variants
          ? {
              variants: product.variants.map((variant) => ({
                id: variant.id,
                name: variant.name,
                priceCents: variant.priceCents,
              })),
            }
          : {}),
        ...(product.tags ? { tags: product.tags } : {}),
        coverImage,
        model: { status: "none" },
        available: product.available ?? true,
        freshFromOvenAt: product.fresh ? FieldValue.serverTimestamp() : null,
        acceptsOrders: true,
        order: index,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  console.log(
    `Seed concluído: ${CATEGORIES.length} categorias, ${PRODUCTS.length} produtos (pt/en/es aprovados). Abra http://demo.localhost:3000`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  });
