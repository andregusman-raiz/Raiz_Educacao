import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { RawRecord, CleanedRecord, AnalysisResult } from './types';
import { FileUploader } from './components/FileUploader';
import { DataTable } from './components/DataTable';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { FilterIcon } from './components/icons/FilterIcon';

type ProcessingStep = 'idle' | 'cleaning' | 'analyzing' | 'done';
type Progress = { processed: number; total: number };

const weights = {
  clareza: 0.20,
  empatia: 0.20,
  coerencia: 0.20,
  formalidade: 0.15,
  eficacia: 0.15,
  linguistica: 0.10,
};

interface ApiResponseItem extends AnalysisResult {
  id: string;
}

const analyzeQualityBatch = async (
  ai: GoogleGenAI,
  batch: Omit<CleanedRecord, 'status'>[]
): Promise<CleanedRecord[]> => {
  const recordsToAnalyze = batch.map(r => ({ id: r._id, text: r.text_clean.substring(0, 2000) }));
  const prompt = `Avalie a qualidade da comunicação de cada texto a seguir segundo as 6 dimensões:
1. Clareza (0–10)
2. Empatia (0–10)
3. Coerência Institucional (0–10)
4. Formalidade e Tom (0–10)
5. Eficácia Comunicativa (0–10)
6. Padrões Linguísticos e Ortográficos (0–10)

Retorne **apenas** um array JSON estruturado no formato:
[{
  "id": "<id do registro>",
  "clareza": <num>,
  "empatia": <num>,
  "coerencia": <num>,
  "formalidade": <num>,
  "eficacia": <num>,
  "linguistica": <num>,
  "comentario": "<texto explicativo curto>"
}, ...]

Textos:
${JSON.stringify(recordsToAnalyze)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              clareza: { type: Type.NUMBER },
              empatia: { type: Type.NUMBER },
              coerencia: { type: Type.NUMBER },
              formalidade: { type: Type.NUMBER },
              eficacia: { type: Type.NUMBER },
              linguistica: { type: Type.NUMBER },
              comentario: { type: Type.STRING },
            },
            required: ['id', 'clareza', 'empatia', 'coerencia', 'formalidade', 'eficacia', 'linguistica', 'comentario']
          }
        }
      }
    });

    const jsonStr = response.text.trim();
    const analysisResults = JSON.parse(jsonStr) as ApiResponseItem[];
    const resultMap = new Map(analysisResults.map(res => [res.id, res]));
    
    return batch.map(record => {
      const result = resultMap.get(record._id);
      if (result) {
        const qualityScore = Object.entries(weights).reduce((acc, [key, weight]) => {
            return acc + (result[key as keyof typeof weights] * weight);
        }, 0);

        return {
          ...record,
          ...result,
          QualityScore: parseFloat(qualityScore.toFixed(2)),
          status: 'Analisado'
        };
      }
      return { ...record, status: 'Falha na Análise', QualityScore: 0 };
    });
  } catch (error) {
    console.error(`Error analyzing batch:`, error);
    return batch.map(record => ({
      ...record,
      status: 'Falha na Análise',
      QualityScore: 0
    }));
  }
};


const App: React.FC = () => {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('comunicados_avaliados.csv');
  const [cleanedData, setCleanedData] = useState<CleanedRecord[]>([]);
  const [displayedData, setDisplayedData] = useState<CleanedRecord[]>([]);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ title: '', community: '', author: '' });

  const isProcessing = processingStep === 'cleaning' || processingStep === 'analyzing';

  useEffect(() => {
    const lowercasedFilters = {
      title: filters.title.toLowerCase(),
      community: filters.community.toLowerCase(),
      author: filters.author.toLowerCase(),
    };

    const filtered = cleanedData.filter(item => {
      return (
        item.title.toLowerCase().includes(lowercasedFilters.title) &&
        item.community.toLowerCase().includes(lowercasedFilters.community) &&
        item.author.toLowerCase().includes(lowercasedFilters.author)
      );
    });
    setDisplayedData(filtered);
  }, [filters, cleanedData]);

  const cleanHtmlAndNormalize = (htmlString: string): string => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      return text.replace(/\s+/g, ' ').replace(/\xa0/g, ' ').trim();
    } catch (e) {
      console.error("Error cleaning HTML: ", e);
      return '';
    }
  };

  const processFile = useCallback(async (file: File) => {
    type ParsedRecord = Omit<CleanedRecord, keyof AnalysisResult | 'QualityScore' | 'status'>;
    return new Promise<ParsedRecord[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          let data: RawRecord[];

          try {
            data = JSON.parse(content);
          } catch (initialError) {
            console.warn("Direct JSON parsing failed. Attempting to fix.", initialError);
            try {
              let fixedContent = content.trim();
              
              if (fixedContent.startsWith('{')) {
                  fixedContent = `[${fixedContent.replace(/}\s*{/g, '},{')}]`;
              } else if (fixedContent.startsWith('[')) {
                  const lastBrace = fixedContent.lastIndexOf('}');
                  const lastBracket = fixedContent.lastIndexOf(']');
                  if (lastBrace > lastBracket) {
                      fixedContent = fixedContent.substring(0, lastBrace + 1) + ']';
                  } else if (lastBracket > -1) {
                      fixedContent = fixedContent.substring(0, lastBracket + 1);
                  }
              }
              fixedContent = fixedContent.replace(/,\s*]$/, ']');

              data = JSON.parse(fixedContent);
            } catch (fixError) {
                console.error("JSON fixing failed:", fixError);
                reject(new Error("Erro de sintaxe: O arquivo não é um JSON válido."));
                return;
            }
          }
          
          if(!Array.isArray(data)){
             throw new Error("O JSON fornecido não é um array. O arquivo deve conter um array de objetos.");
          }

          const processedRecords: ParsedRecord[] = data.map((item) => {
            if (typeof item !== 'object' || item === null) return null;
            const descriptionRaw = item.description || '';
            const cleanText = cleanHtmlAndNormalize(descriptionRaw);
            return {
              _id: item._id?.$oid || `${Date.now()}-${Math.random()}`,
              title: item.title || '',
              community: item.community || '',
              author: item.author?.name || '',
              text_clean: cleanText,
              word_count: cleanText ? cleanText.split(' ').length : 0,
            };
          }).filter((record): record is ParsedRecord => record !== null);
          resolve(processedRecords);
        } catch (e) {
          if (e instanceof Error) {
            reject(new Error(`Erro ao processar o arquivo: ${e.message}`));
          } else {
            reject(new Error("Ocorreu um erro desconhecido durante o processamento."));
          }
        }
      };
      reader.onerror = () => {
        reject(new Error("Não foi possível ler o arquivo."));
      };
      reader.readAsText(file, 'UTF-8');
    });
  }, []);

  const handleProcessClick = useCallback(async () => {
    if (!inputFile) {
      setError('Por favor, selecione um arquivo JSON primeiro.');
      return;
    }
    setError(null);
    setCleanedData([]);
    setDisplayedData([]);
    setProcessingStep('cleaning');
    setProgress({ processed: 0, total: 0 });

    try {
      const cleanedResults = await processFile(inputFile);

      if (cleanedResults.length === 0) {
        setProcessingStep('done');
        setError("Nenhum registro válido encontrado no arquivo.");
        return;
      }
      
      setProcessingStep('analyzing');
      setProgress({ processed: 0, total: cleanedResults.length });
      const initialData: CleanedRecord[] = cleanedResults.map(record => ({
        ...record,
        status: 'Aguardando IA...'
      }));
      setCleanedData(initialData);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const BATCH_SIZE = 10;

      for (let i = 0; i < cleanedResults.length; i += BATCH_SIZE) {
        const batch = cleanedResults.slice(i, i + BATCH_SIZE);
        const analyzedBatch = await analyzeQualityBatch(ai, batch);
        
        setCleanedData(prevData => {
            const newData = [...prevData];
            analyzedBatch.forEach(analyzedRecord => {
                const index = newData.findIndex(item => item._id === analyzedRecord._id);
                if (index !== -1) {
                    newData[index] = { ...newData[index], ...analyzedRecord };
                }
            });
            return newData;
        });

        setProgress(prevProgress => ({
          ...prevProgress,
          processed: Math.min(prevProgress.processed + batch.length, cleanedResults.length),
        }));

        if (i + BATCH_SIZE < cleanedResults.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      setProcessingStep('done');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro desconhecido.');
      }
      setProcessingStep('idle');
    }
  }, [inputFile, processFile]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const convertToCsv = (data: CleanedRecord[]): string => {
    if (data.length === 0) return '';
    const headers = [
      'title', 'community', 'author', 'text_clean', 'word_count', 
      'clareza', 'empatia', 'coerencia', 'formalidade', 'eficacia', 'linguistica', 
      'QualityScore', 'comentario', 'status'
    ];
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header as keyof CleanedRecord] ?? '';
            const escaped = ('' + value).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  };

  const handleDownloadClick = () => {
    if (displayedData.length === 0) return;

    const csvContent = convertToCsv(displayedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', outputFileName.endsWith('.csv') ? outputFileName : `${outputFileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getButtonText = () => {
    switch (processingStep) {
      case 'cleaning':
        return 'Limpando...';
      case 'analyzing':
        return `Analisando... (${progress.processed}/${progress.total})`;
      default:
        return 'Limpar, Analisar e Exportar';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-sky-400">
            Processador Inteligente de Comunicados
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
            Faça o upload, limpe, analise a qualidade com IA e filtre seus comunicados. Exporte como CSV.
          </p>
        </header>

        {/* Controls Section */}
        <section className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">1. Upload do arquivo JSON</label>
              <FileUploader onFileSelect={setInputFile} disabled={isProcessing} />
            </div>
            <div className="space-y-4">
              <div>
                  <label htmlFor="output-filename" className="block text-sm font-medium text-slate-300 mb-2">
                    2. Nome do arquivo de saída
                  </label>
                  <input
                    type="text"
                    id="output-filename"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm px-4 py-2 text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                    placeholder="comunicados_avaliados.csv"
                  />
              </div>
              <button
                onClick={handleProcessClick}
                disabled={!inputFile || isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-3 px-4 rounded-md hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sky-900/50"
              >
                {isProcessing && <SpinnerIcon className="w-5 h-5"/>}
                {getButtonText()}
              </button>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className="space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-bold">Erro: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {cleanedData.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h2 className="text-xl font-semibold mb-4 text-sky-300 flex items-center gap-2">
                <FilterIcon className="w-6 h-6" />
                Filtros de Pesquisa
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" name="title" placeholder="Filtrar por título..." value={filters.title} onChange={handleFilterChange} className="bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition" />
                <input type="text" name="community" placeholder="Filtrar por comunidade..." value={filters.community} onChange={handleFilterChange} className="bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition" />
                <input type="text" name="author" placeholder="Filtrar por autor..." value={filters.author} onChange={handleFilterChange} className="bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition" />
              </div>
            </div>
          )}

          {processingStep !== 'idle' && processingStep !== 'cleaning' ? (
            <div className="space-y-6">
              <DataTable data={displayedData} title={`Resultados da Análise (${displayedData.length} de ${cleanedData.length})`} />
              {displayedData.length > 0 && (
                  <button
                    onClick={handleDownloadClick}
                    disabled={isProcessing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-6 rounded-md hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-green-900/50"
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Baixar {displayedData.length} registros analisados como CSV
                  </button>
              )}
            </div>
          ) : (
            processingStep === 'idle' && !error && (
              <div className="bg-slate-800/50 rounded-lg p-10 border border-slate-700 text-center">
                <p className="text-slate-400">Os resultados aparecerão aqui após o processamento.</p>
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
};

export default App;