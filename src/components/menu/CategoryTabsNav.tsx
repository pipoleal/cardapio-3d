"use client";

import { useEffect, useState } from "react";
import { pillClassName } from "@/components/ui/Pill";

type CategoryTabItem = { id: string; label: string };

/**
 * Destaca a aba da categoria visível ao rolar: observa cada `<section
 * id="categoria-<id>">` com uma faixa fina perto do topo da tela (abaixo da
 * barra sticky) — a seção que cruza essa faixa vira a ativa. `rootMargin`
 * negativo em vez de medir a barra sticky em JS: mais leve, sem
 * `ResizeObserver` nem `getBoundingClientRect` a cada scroll.
 */
export function CategoryTabsNav({ items, navLabel }: { items: CategoryTabItem[]; navLabel: string }) {
  const [activeId, setActiveId] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(`categoria-${item.id}`))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id.replace("categoria-", ""));
          }
        }
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label={navLabel}
      className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-bg px-4 py-3"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#categoria-${item.id}`}
          className={pillClassName(item.id === activeId, "shrink-0")}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
