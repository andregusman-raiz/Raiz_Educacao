import React, { useState, useCallback } from 'react';
import { FileJsonIcon } from './icons/FileJsonIcon';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 w-full text-center transition-colors duration-200 ${
        dragActive ? 'border-sky-400 bg-slate-700' : 'border-slate-600 hover:border-sky-500'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept=".json"
        disabled={disabled}
      />
      <label htmlFor="input-file-upload" className="flex flex-col items-center justify-center">
        <FileJsonIcon className="w-10 h-10 mb-3 text-slate-400" />
        <p className="text-slate-400">
          Arraste e solte o arquivo JSON aqui, ou{' '}
          <span onClick={onButtonClick} className="font-bold text-sky-400 hover:underline">
            clique para selecionar
          </span>
        </p>
        <p className="text-xs text-slate-500 mt-1">Máx. ~30 MB por parte</p>
        {selectedFile && <p className="text-sm text-green-400 mt-2">Arquivo selecionado: {selectedFile.name}</p>}
      </label>
    </div>
  );
};
