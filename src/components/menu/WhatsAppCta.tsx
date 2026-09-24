type WhatsAppCtaProps = {
  href: string;
  label: string;
  caption?: string;
};

// Barra fixa no rodapé (mockup 01/02). `<a>` estilizado direto (não usa o
// Button de ui/) pra não aninhar um <button> dentro de um <a>.
export function WhatsAppCta({ href, label, caption }: WhatsAppCtaProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="whatsapp-cta-prominent"
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-cta bg-accent text-base font-medium text-surface hover:opacity-90"
      >
        <WhatsAppIcon />
        {label}
      </a>
      {caption && <p className="mt-1 text-center text-xs text-muted">{caption}</p>}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.4.1.2 1.6 2.5 4 3.5.6.2 1 .4 1.3.5.6.2 1.1.1 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
