export interface RawRecord {
  _id?: {
    $oid?: string;
  };
  title?: string;
  community?: string;
  author?: {
    name?: string;
  };
  description?: string;
  [key: string]: any; // Allow other properties
}

export interface AnalysisResult {
  clareza: number;
  empatia: number;
  coerencia: number;
  formalidade: number;
  eficacia: number;
  linguistica: number;
  comentario: string;
}

export interface CleanedRecord extends Partial<AnalysisResult> {
  _id: string;
  title: string;
  community: string;
  author: string;
  text_clean: string;
  word_count: number;
  status: 'Aguardando IA...' | 'Analisado' | 'Falha na Análise';
  QualityScore?: number;
}
