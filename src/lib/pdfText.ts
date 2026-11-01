// Extração de texto de PDF (com texto) no navegador via pdf.js, em ORDEM NATURAL
// (ordem do content-stream) — ideal para os relatórios de Situação Fiscal do e-CAC,
// onde cada linha lógica sai contígua. (O import de DARF usa outro método, por
// coordenada, em importPdf.ts.)
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjs: any = null;

async function getPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import("pdfjs-dist");
  // Worker servido como asset estático; sob Multi-Zones o app roda com basePath /fiscal.
  pdfjs.GlobalWorkerOptions.workerSrc = "/fiscal/pdf.worker.min.js";
  return pdfjs;
}

/** Lê o PDF e devolve o texto de cada página (itens na ordem natural, 1 string/página). */
export async function lerPaginasNaturais(file: File): Promise<{ paginas: string[]; chars: number }> {
  const lib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const paginas: string[] = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    chars += tc.items.reduce((s: number, it: any) => s + (it.str || "").length, 0);
    paginas.push(tc.items.map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim());
  }
  return { paginas, chars };
}
