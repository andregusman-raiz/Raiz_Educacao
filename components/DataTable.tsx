import React from 'react';
import { CleanedRecord } from '../types';
import { TableIcon } from './icons/TableIcon';

interface DataTableProps {
  data: CleanedRecord[];
  title: string;
}

const headers = [
  'status',
  'QualityScore',
  'title',
  'community',
  'author',
  'comentario',
  'text_clean',
  'word_count',
  'clareza',
  'empatia',
  'coerencia',
  'formalidade',
  'eficacia',
  'linguistica',
];

const headerDisplayNames: { [key: string]: string } = {
    status: 'Status',
    QualityScore: 'Quality Score',
    title: 'Title',
    community: 'Community',
    author: 'Author',
    comentario: 'Comentário IA',
    text_clean: 'Texto Limpo',
    word_count: 'Word Count',
    clareza: 'Clareza',
    empatia: 'Empatia',
    coerencia: 'Coerência',
    formalidade: 'Formalidade',
    eficacia: 'Eficácia',
    linguistica: 'Linguística',
};


export const DataTable: React.FC<DataTableProps> = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
        <div className="bg-slate-800/50 rounded-lg p-10 border border-slate-700 text-center">
            <p className="text-slate-400">Nenhum resultado encontrado para os filtros aplicados.</p>
        </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-semibold mb-4 text-sky-300 flex items-center gap-2">
        <TableIcon className="w-6 h-6" />
        {title}
      </h2>
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto relative">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-sky-300 uppercase bg-slate-800 sticky top-0">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-6 py-3 whitespace-nowrap">
                  {headerDisplayNames[header] || header.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={row._id || rowIndex} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                {headers.map((header) => {
                  const value = row[header as keyof CleanedRecord];
                  let cellContent: React.ReactNode = value ?? '–';
                  let cellClassName = "px-6 py-4";

                  if (header === 'status') {
                    switch(value) {
                        case 'Analisado':
                            cellClassName += ' text-green-400 font-semibold';
                            break;
                        case 'Falha na Análise':
                            cellClassName += ' text-red-400 font-semibold';
                            break;
                        case 'Aguardando IA...':
                             cellClassName += ' text-yellow-400 font-semibold';
                            break;
                    }
                  } else if (header === 'comentario' || header === 'text_clean') {
                      cellClassName += ' min-w-[20rem] max-w-sm';
                  }


                  return (
                    <td key={`${row._id}-${header}`} className={cellClassName}>
                      <span title={typeof value === 'string' ? value : undefined}>{cellContent}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
