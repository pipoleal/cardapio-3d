/**
 * Gera public/sample-models/doce.gltf — um cubo simples (glTF em JSON +
 * buffer embutido em base64, não .glb binário: mais fácil de montar
 * certo à mão sem precisar acertar alinhamento de bytes num arquivo
 * binário). Só serve pro `FakeModelProvider` (Etapa 4, MODEL_PROVIDER
 * != "meshy") — exercita o pipeline inteiro (viewer, AR no Android, selo
 * 3D) sem gastar crédito nem depender de rede. Sem USDZ (não dá pra
 * fabricar um USDZ válido à mão) — o botão de AR não aparece no iPhone em
 * modo fake.
 *
 * Rodar de novo só se quiser trocar a forma/cor:
 *   npx tsx scripts/generate-sample-model.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// 24 vértices (4 por face × 6 faces — duplicados nas arestas de propósito,
// pra cada face ter sua própria normal e não ficar com sombreamento
// "borrado" entre faces).
const s = 0.5;
const positions: number[] = [];
const normals: number[] = [];
const indices: number[] = [];

const faces: { normal: [number, number, number]; corners: [number, number, number][] }[] = [
  { normal: [0, 0, 1], corners: [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]] },
  { normal: [0, 0, -1], corners: [[s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s]] },
  { normal: [1, 0, 0], corners: [[s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s]] },
  { normal: [-1, 0, 0], corners: [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]] },
  { normal: [0, 1, 0], corners: [[-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s]] },
  { normal: [0, -1, 0], corners: [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]] },
];

for (const face of faces) {
  const base = positions.length / 3;
  for (const corner of face.corners) {
    positions.push(...corner);
    normals.push(...face.normal);
  }
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const positionsBuf = Buffer.from(new Float32Array(positions).buffer);
const normalsBuf = Buffer.from(new Float32Array(normals).buffer);
const indicesBuf = Buffer.from(new Uint16Array(indices).buffer);

// bufferViews de 4 em 4 bytes (glTF exige alinhamento de 4 bytes pros
// accessors) — os três já são múltiplos de 4 (float32/uint16 par), então
// não precisa de padding aqui.
const buffer = Buffer.concat([positionsBuf, normalsBuf, indicesBuf]);
const positionsOffset = 0;
const normalsOffset = positionsBuf.length;
const indicesOffset = positionsBuf.length + normalsBuf.length;

const min = [-s, -s, -s];
const max = [s, s, s];

const gltf = {
  asset: { version: "2.0", generator: "scripts/generate-sample-model.ts (cardapio-3d)" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [
    {
      primitives: [
        { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
      ],
    },
  ],
  materials: [
    {
      name: "amostra",
      pbrMetallicRoughness: {
        baseColorFactor: [0.75, 0.55, 0.38, 1.0],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126, // FLOAT
      count: positions.length / 3,
      type: "VEC3",
      min,
      max,
    },
    { bufferView: 1, componentType: 5126, count: normals.length / 3, type: "VEC3" },
    { bufferView: 2, componentType: 5123, count: indices.length, type: "SCALAR" }, // UNSIGNED_SHORT
  ],
  bufferViews: [
    { buffer: 0, byteOffset: positionsOffset, byteLength: positionsBuf.length, target: 34962 },
    { buffer: 0, byteOffset: normalsOffset, byteLength: normalsBuf.length, target: 34962 },
    { buffer: 0, byteOffset: indicesOffset, byteLength: indicesBuf.length, target: 34963 },
  ],
  buffers: [
    {
      byteLength: buffer.length,
      uri: `data:application/octet-stream;base64,${buffer.toString("base64")}`,
    },
  ],
};

const outDir = path.join(process.cwd(), "public", "sample-models");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "doce.gltf"), JSON.stringify(gltf), "utf8");

const poster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#EFD9C6"/><rect x="120" y="120" width="160" height="160" rx="16" fill="#2A1C15" opacity="0.85"/></svg>`;
writeFileSync(path.join(outDir, "doce-poster.svg"), poster, "utf8");

console.log(`Gerado: ${path.join(outDir, "doce.gltf")} (${buffer.length} bytes de buffer) e doce-poster.svg`);
