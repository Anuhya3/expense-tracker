import { useState, useRef, DragEvent } from 'react';
import { Upload, X, ScanLine, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { ReceiptScanResult, CategoryId } from '../types';
import { formatCurrency, getCategoryInfo } from '../utils/format';

interface Props {
  onUseResult: (result: ReceiptScanResult) => void;
  onClose: () => void;
}

export default function ReceiptScanner({ onUseResult, onClose }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ data: ReceiptScanResult; mode: string } | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

  const handleFile = (f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      setError('Only JPEG, PNG, and WebP images are accepted.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const res = await api.upload<{ success: boolean; mode: string; data: ReceiptScanResult }>('/ai/scan-receipt', fd);
      setResult({ data: res.data, mode: res.mode });
    } catch (err: any) {
      setError(err.message || 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-bold dark:text-gray-100">Scan Receipt</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Drop zone */}
        {!preview && (
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-gray-900 dark:border-gray-300 bg-gray-50 dark:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Drop receipt image here</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse · JPEG, PNG, WebP · max 5 MB</p>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {/* Preview */}
        {preview && !result && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={preview} alt="Receipt preview" className="w-full max-h-56 object-contain bg-gray-50 dark:bg-gray-900" />
              <button
                onClick={reset}
                className="absolute top-2 right-2 p-1 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scanning receipt...
                </>
              ) : (
                <>
                  <ScanLine className="w-4 h-4" />
                  Scan with AI
                </>
              )}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Receipt scanned successfully</span>
              {result.mode === 'demo' && (
                <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg">Demo mode</span>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold dark:text-white">{formatCurrency(result.data.amount)}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(result.data.confidence * 100)}% confidence</span>
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{result.data.description}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: getCategoryInfo(result.data.category as CategoryId).color }}>
                  {getCategoryInfo(result.data.category as CategoryId).icon} {getCategoryInfo(result.data.category as CategoryId).label}
                </span>
                {result.data.date && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">· {result.data.date}</span>
                )}
              </div>
              {result.data.items.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 border-t border-gray-200 dark:border-gray-700 pt-2">
                  {result.data.items.slice(0, 5).map((item, i) => (
                    <div key={i}>· {item}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary flex-1 text-sm">Scan another</button>
              <button onClick={() => onUseResult(result.data)} className="btn-primary flex-1 text-sm">Use this</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
