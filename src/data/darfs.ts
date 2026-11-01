// DARFs (tributos federais) — dados POR INSTÂNCIA, entram por importação de PDF
// (comprovantes de arrecadação da Receita / e-CAC com texto) e ficam no banco
// (trib_darfs). Este é um módulo REUTILIZÁVEL (tributos-web): não traz dados de
// nenhuma empresa embutidos. Tudo é considerado pela importação.

export interface DarfLinha {
  id: number;
  arquivo: string;          // origem (página do PDF)
  cnpj: string;             // CNPJ da empresa
  codigo: string;           // código do tributo (DARF)
  tributo: string;          // descrição do tributo
  periodoApuracao: string | null; // ISO; null = não informado no comprovante
  vencimento: string | null;      // ISO — data de vencimento
  recolhimento: string | null;    // ISO — data de arrecadação (recolhimento)
  principal: number;
  multa: number;
  juros: number;
  total: number;            // valor efetivamente recolhido
  banco: string;
  numeroDocumento: string;
  arquivoPath?: string;     // caminho do PDF de origem no Storage (opcional)
}

export const DARFS: DarfLinha[] = [];
