"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCategory, deleteCategory, reorderCategories, updateCategoryName } from "@/lib/actions/categories";

type CategoryItem = { id: string; name: string };

// Sem drag-and-drop (biblioteca nova, fora do stack aprovado) — setas
// cima/baixo chamam a mesma `reorderCategories`, então dá pra trocar a UI
// depois sem mexer na action.
export function CategoryManager({
  tenantId,
  categories,
}: {
  tenantId: string;
  categories: CategoryItem[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pending, setPending] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setPending(true);
    try {
      await createCategory(tenantId, newName.trim());
      setNewName("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleRename(id: string) {
    setEditingId(null);
    if (!editingName.trim()) return;
    setPending(true);
    try {
      await updateCategoryName(tenantId, id, editingName.trim());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar esta categoria? Os produtos dela não são apagados.")) return;
    setPending(true);
    try {
      await deleteCategory(tenantId, id);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved!);
    setPending(true);
    try {
      await reorderCategories(
        tenantId,
        reordered.map((category) => category.id),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col divide-y divide-border">
        {categories.map((category, index) => (
          <div key={category.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex flex-col text-xs leading-none">
              <button
                type="button"
                disabled={index === 0 || pending}
                onClick={() => handleMove(index, -1)}
                aria-label="Mover pra cima"
                className="text-muted disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={index === categories.length - 1 || pending}
                onClick={() => handleMove(index, 1)}
                aria-label="Mover pra baixo"
                className="text-muted disabled:opacity-30"
              >
                ▼
              </button>
            </div>

            {editingId === category.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={() => handleRename(category.id)}
                onKeyDown={(event) => event.key === "Enter" && handleRename(category.id)}
                className="min-h-11 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-ink"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(category.id);
                  setEditingName(category.name);
                }}
                className="flex-1 text-left text-sm font-medium text-ink"
              >
                {category.name}
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(category.id)}
              className="text-sm text-rec hover:underline"
            >
              Apagar
            </button>
          </div>
        ))}
        {categories.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nenhuma categoria ainda.</p>}
      </Card>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nova categoria"
          className="min-h-11 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-ink"
        />
        <Button type="submit" disabled={pending}>
          Adicionar
        </Button>
      </form>
    </div>
  );
}
