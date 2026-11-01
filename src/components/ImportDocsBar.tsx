"use client";

// Botão único de importação de documentos fiscais (roteia por tipo em importDocs.ts).
export default function ImportDocsBar({ onImportar, importando, canEdit }: { onImportar: (f: File[]) => void; importando: boolean; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <label className={`cursor-pointer rounded-lg border border-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${importando ? "opacity-60" : ""}`}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          disabled={importando}
          onChange={(ev) => {
            const fs = Array.from(ev.target.files || []);
            ev.currentTarget.value = "";
            if (fs.length) onImportar(fs);
          }}
        />
        {importando ? "Importando…" : "⬆ Importar documentos (PDF)"}
      </label>
      <span className="text-slate-500">
        Aceita, juntos: relatório de <b>Situação Fiscal</b> do e-CAC (RFB + PGFN), <b>CNDT</b>, <b>CND FGTS</b> e páginas de
        <b> pedido de parcelamento</b> do e-CAC (consolidação e demonstrativo de pagamentos). Cada envio vira histórico; os PDFs
        não são armazenados.
      </span>
    </div>
  );
}
