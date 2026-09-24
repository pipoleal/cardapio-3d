/**
 * Popula o emulador com a loja "demo" (confeitaria): 4 categorias, 10
 * produtos e capas placeholder (ícone simples sobre --color-thumb-1/2/3,
 * ver docs/REFERENCIAS-VISUAIS.md) geradas em public/demo/.
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

type Category = { id: string; name: string; order: number };

const CATEGORIES: Category[] = [
  { id: "brigadeiros", name: "Brigadeiros", order: 0 },
  { id: "tortas", name: "Tortas", order: 1 },
  { id: "croissants", name: "Croissants", order: 2 },
  { id: "bolos", name: "Bolos", order: 3 },
];

type ProductVariant = { id: string; name: string; priceCents: number };

type SeedProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  servings?: number;
  allergens: Allergen[];
  mayContain?: Allergen[];
  variants?: ProductVariant[];
  tags?: ("vegan" | "sugar_free" | "gluten_free" | "new" | "bestseller")[];
  available?: boolean;
  fresh?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  {
    id: "brigadeiro-tradicional",
    categoryId: "brigadeiros",
    name: "Brigadeiro tradicional",
    description: "O clássico: chocolate ao leite, feito na hora e enrolado na granulada.",
    priceCents: 350,
    allergens: ["milk", "lactose"],
    tags: ["bestseller"],
    variants: [
      { id: "c6", name: "Caixa com 6", priceCents: 1800 },
      { id: "c12", name: "Caixa com 12", priceCents: 3400 },
      { id: "c25", name: "Caixa com 25", priceCents: 6500 },
    ],
  },
  {
    id: "brigadeiro-ninho",
    categoryId: "brigadeiros",
    name: "Brigadeiro de ninho",
    description: "Recheio de leite ninho com um brigadeiro de chocolate branco por fora.",
    priceCents: 400,
    allergens: ["milk", "lactose"],
    variants: [
      { id: "c6", name: "Caixa com 6", priceCents: 2100 },
      { id: "c12", name: "Caixa com 12", priceCents: 3900 },
    ],
  },
  {
    id: "brigadeiro-pistache",
    categoryId: "brigadeiros",
    name: "Brigadeiro de pistache",
    description: "Brigadeiro branco com pistache torrado e moído na hora.",
    priceCents: 500,
    allergens: ["milk", "lactose", "tree_nuts"],
    tags: ["new"],
  },
  {
    id: "torta-de-limao",
    categoryId: "tortas",
    name: "Torta de limão",
    description: "Massa amanteigada, creme de limão e merengue maçaricado na hora.",
    priceCents: 6500,
    servings: 8,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "torta-de-morango",
    categoryId: "tortas",
    name: "Torta de morango",
    description: "Base de massa amanteigada, creme de confeiteiro e morangos frescos.",
    priceCents: 7000,
    servings: 8,
    allergens: ["gluten", "egg", "milk", "lactose"],
    available: false,
  },
  {
    id: "croissant-doce-chocolate",
    categoryId: "croissants",
    name: "Croissant doce de chocolate",
    description: "Massa folhada amanteigada com recheio generoso de chocolate.",
    priceCents: 1200,
    allergens: ["gluten", "egg", "milk"],
    fresh: true,
  },
  {
    id: "croissant-doce-de-leite",
    categoryId: "croissants",
    name: "Croissant doce de leite",
    description: "Massa folhada crocante recheada com doce de leite artesanal.",
    priceCents: 1200,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "bolo-de-chocolate",
    categoryId: "bolos",
    name: "Bolo de chocolate",
    description: "Massa de chocolate fofinha com cobertura de ganache.",
    priceCents: 9000,
    servings: 12,
    allergens: ["gluten", "egg", "milk", "lactose"],
    mayContain: ["tree_nuts"],
    tags: ["bestseller"],
    variants: [
      { id: "p", name: "P · serve 6", priceCents: 6000 },
      { id: "m", name: "M · serve 12", priceCents: 9000 },
      { id: "g", name: "G · serve 20", priceCents: 14000 },
    ],
  },
  {
    id: "bolo-red-velvet",
    categoryId: "bolos",
    name: "Bolo red velvet",
    description: "Massa aveludada com cream cheese, clássico americano.",
    priceCents: 9500,
    servings: 12,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
  {
    id: "bolo-cenoura-com-chocolate",
    categoryId: "bolos",
    name: "Bolo de cenoura com cobertura de chocolate",
    description: "Bolo de cenoura fofinho com cobertura cremosa de chocolate.",
    priceCents: 8500,
    servings: 10,
    allergens: ["gluten", "egg", "milk", "lactose"],
  },
];

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
      description: { pt: "Doces artesanais feitos à mão, todos os dias." },
      whatsapp: "5511999999999",
      whatsappTemplate: { pt: "Olá! Quero encomendar {produto} ({variacao})." },
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
      .set({ name: { pt: category.name }, order: category.order, active: true });
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
        name: { pt: product.name },
        description: { pt: product.description },
        priceCents: product.priceCents,
        ...(product.servings ? { servings: product.servings } : {}),
        allergens: product.allergens,
        ...(product.mayContain ? { mayContain: product.mayContain } : {}),
        ...(product.variants
          ? {
              variants: product.variants.map((variant) => ({
                id: variant.id,
                name: { pt: variant.name },
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
    `Seed concluído: ${CATEGORIES.length} categorias, ${PRODUCTS.length} produtos. Abra http://demo.localhost:3000`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  });
