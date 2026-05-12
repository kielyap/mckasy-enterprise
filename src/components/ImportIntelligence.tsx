import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { db, collection, addDoc, serverTimestamp, handleFirestoreError, OperationType, Timestamp } from '../lib/firebase';
import { Upload, FileSpreadsheet, X, Check, BrainCircuit, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImportIntelligenceProps {
  collectionName: string;
  schemaDetails: string;
  onComplete?: () => void;
  title: string;
}

export default function ImportIntelligence({ collectionName, schemaDetails, onComplete, title }: ImportIntelligenceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = React.useMemo(() => {
    try {
      // @ts-ignore - process.env is injected by Vite at build time via define
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;
      return new GoogleGenAI({ apiKey: key });
    } catch (e) {
      console.error("Gemini init error:", e);
      return null;
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ai) {
      setError("AI System is not configured. Please check your API keys.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setParsedData(null);

    try {
      const text = await file.text();
      
      const prompt = `
        You are a data migration expert. Analyze the following CSV content and map it to our database schema for "${collectionName}".
        
        CSV CONTENT:
        ${text.slice(0, 5000)} // Truncate if too long
        
        SCHEMA REQUIREMENTS for ${collectionName}:
        ${schemaDetails}
        
        CRITICAL RULES:
        1. Return ONLY a JSON array of objects.
        2. Clean the data (e.g., trim strings, ensure numbers are numbers, format dates if possible).
        3. If a field is missing but required, try to infer it or leave null.
        4. NEVER wrap the response in markdown code blocks. Just raw JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const data = JSON.parse(response.text.trim());
      if (Array.isArray(data)) {
        setParsedData(data);
      } else {
        throw new Error("Invalid format returned from analysis.");
      }
    } catch (err: any) {
      console.error("Migration error:", err);
      setError(err.message || "Failed to analyze CSV. Please ensure it's a valid format.");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveToDatabase = async () => {
    if (!parsedData) return;
    setIsSaving(true);

    try {
      const colRef = collection(db, collectionName);
      const promises = parsedData.map(item => {
        // Convert date strings to Firestore Timestamps
        const processedItem = { ...item };
        Object.keys(processedItem).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('date') && typeof processedItem[key] === 'string') {
            try {
              const dateVal = new Date(processedItem[key]);
              if (!isNaN(dateVal.getTime())) {
                processedItem[key] = Timestamp.fromDate(dateVal);
              }
            } catch (e) {
              console.warn(`Failed to convert ${key} to date:`, processedItem[key]);
            }
          }
        });

        return addDoc(colRef, {
          ...processedItem,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await Promise.all(promises);
      setIsOpen(false);
      setParsedData(null);
      if (onComplete) onComplete();
      alert(`Successfully imported ${parsedData.length} records to ${collectionName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, collectionName);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border-2 border-[#141414] bg-white text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
      >
        <Upload className="h-3 w-3" />
        Import {title}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] bg-[#E4E3E0] border-[4px] border-[#141414] shadow-[24px_24px_0px_0px_rgba(20,20,20,1)] flex flex-col"
            >
              <div className="p-6 border-b-4 border-[#141414] flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 border-2 border-[#141414] bg-[#141414] text-[#E4E3E0]">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold uppercase tracking-tighter italic">AI Import Assistant: {title}</h3>
                    <p className="text-[10px] font-mono opacity-50 uppercase mt-1">Schema Mapping // Gemini Intelligence Enabled</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8">
                {!parsedData && !isAnalyzing && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-64 border-4 border-dashed border-[#141414]/20 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#141414]/40 transition-all bg-white/50"
                  >
                    <FileSpreadsheet className="h-12 w-12 opacity-20" />
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase">Drop CSV File or Click to Browse</p>
                      <p className="text-[9px] font-mono opacity-40 mt-2">Maximum file size: 2MB // AI will map headers automatically</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv"
                      className="hidden"
                    />
                  </div>
                )}

                {isAnalyzing && (
                  <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase animate-pulse">Analyzing Data Structure</p>
                      <p className="text-[9px] font-mono opacity-40 mt-2 italic">Mapping legacy columns to system architecture...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 text-xs font-bold uppercase flex items-center gap-3 mb-6">
                    <X className="h-5 w-5" />
                    {error}
                  </div>
                )}

                {parsedData && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest bg-[#141414] text-[#E4E3E0] px-3 py-1">Analysis Preview ({parsedData.length} Records)</h4>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setParsedData(null)}
                          className="text-[10px] uppercase font-bold text-red-500 hover:underline"
                        >
                          Clear & Reset
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-2 border-[#141414] bg-white overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] font-mono">
                          <thead>
                            <tr className="bg-[#141414] text-[#E4E3E0]">
                              {Object.keys(parsedData[0] || {}).map(key => (
                                <th key={key} className="px-3 py-2 border-r border-[#E4E3E0]/10 uppercase">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedData.slice(0, 10).map((row, i) => (
                              <tr key={i} className="border-b border-[#141414]/10 hover:bg-[#E4E3E0]/30">
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="px-3 py-2 border-r border-[#141414]/10 truncate max-w-[150px]">
                                    {String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {parsedData.length > 10 && (
                        <div className="p-2 text-center text-[9px] font-bold opacity-30 border-t border-[#141414]/10 bg-gray-50 italic">
                          Showing first 10 of {parsedData.length} records...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t-4 border-[#141414] bg-white flex justify-end gap-4">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 border-2 border-[#141414] text-[10px] font-bold uppercase hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                {parsedData && (
                  <button 
                    onClick={saveToDatabase}
                    disabled={isSaving}
                    className="px-8 py-3 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {isSaving ? 'Importing...' : 'Commit to Database'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
