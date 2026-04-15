import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, BookOpen, Loader2, Library, Settings, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SourceType } from '../App';
import { StorageService, SavedBook, BookProgress } from '../services/StorageService';

interface GatewayProps {
  onDocumentSelected: (source: string | File, type: SourceType, filename: string, fileType?: string) => void;
}

interface CatalogBook {
  id?: string;
  title: string;
  author: string;
  coverUrl: string;
  textUrl: string;
}

export function Gateway({ onDocumentSelected }: GatewayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [personalBooks, setPersonalBooks] = useState<SavedBook[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress>>({});
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteFor, setShowDeleteFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load curated catalog
    fetch('https://raw.githubusercontent.com/camouflagechicken/EzRead-Library/main/catalog.json')
      .then(res => res.json())
      .then(data => {
        setCatalog(Array.isArray(data) ? data : data.books || []);
      })
      .catch(err => {
        console.error("Failed to load catalog", err);
        setError("Failed to load curated library.");
      })
      .finally(() => {
        setIsLoadingCatalog(false);
      });

    // Load personal vault
    StorageService.getAllBooks()
      .then(setPersonalBooks)
      .catch(console.error);
      
    // Load progress
    StorageService.getAllProgress()
      .then(setProgressMap)
      .catch(console.error);
  }, []);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      setError('Please upload a valid PDF or TXT file.');
      return;
    }
    setError(null);
    setIsProcessing(true);

    try {
      const id = crypto.randomUUID();
      const title = file.name.replace(/\.[^/.]+$/, "");
      const fileType = file.type === 'application/pdf' ? 'pdf' : 'txt';
      
      let fileData = '';
      if (fileType === 'pdf') {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      } else {
        fileData = await file.text();
      }

      await StorageService.saveBook(id, title, fileData, fileType, '');
      const updatedBooks = await StorageService.getAllBooks();
      setPersonalBooks(updatedBooks);
      setIsProcessing(false);
    } catch (err: any) {
      setError('Failed to save book to local vault.');
      setIsProcessing(false);
    }
  };

  const handleBookClick = (book: CatalogBook) => {
    onDocumentSelected(book.textUrl, 'cloud-txt', book.title);
  };

  const handleDeleteLocalBook = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await StorageService.deleteBook(id);
      setPersonalBooks(prev => prev.filter(b => b.id !== id));
      setShowDeleteFor(null);
    } catch (err) {
      setError('Failed to delete book.');
    }
  };

  const toggleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShowDeleteFor(showDeleteFor === id ? null : id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 font-sans text-zinc-100 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 mb-10"
        >
          <h1 className="text-3xl font-bold tracking-tighter text-zinc-100">EzRead</h1>
          <p className="text-zinc-500 text-sm">
            Sovereign local reader. Select a text to begin.
          </p>
        </motion.div>

        {/* Library Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-medium flex items-center gap-2 border-b border-zinc-900 pb-4">
            <BookOpen className="w-6 h-6 text-zinc-400" />
            The Vault
          </h2>
          
          {isLoadingCatalog ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          ) : (
            <div 
              className="grid gap-4 sm:gap-6" 
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              
              {/* Upload Card (First Item) */}
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className="group cursor-pointer flex flex-col gap-3"
              >
                <div className={`aspect-[2/3] w-full rounded-xl overflow-hidden border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 p-4 text-center shadow-lg shadow-black/50
                  ${isDragging ? 'border-zinc-300 bg-zinc-900/50' : 'border-zinc-700 bg-zinc-900/20 group-hover:border-zinc-500 group-hover:bg-zinc-900/40'}
                  ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}>
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                      <p className="text-zinc-300 font-medium text-sm">Saving...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-full bg-zinc-800/50 text-zinc-300 group-hover:text-zinc-100 group-hover:bg-zinc-700/50 transition-colors">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-zinc-200 font-medium text-lg">Upload Book</p>
                        <p className="text-zinc-500 text-sm mt-1">PDF or TXT</p>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200 leading-tight">Local File</h3>
                  <p className="text-sm text-zinc-500 mt-1">From your device</p>
                </div>
              </motion.div>

              {/* Personal Vault Books */}
              {personalBooks.map((book) => (
                <motion.div
                  key={book.id}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onDocumentSelected(book.id, 'local-db', book.title, book.fileType)}
                  className="group cursor-pointer flex flex-col gap-3 relative"
                >
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 relative shadow-lg shadow-black/50 flex items-center justify-center">
                    <Library className="w-12 h-12 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Settings / Delete Actions */}
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <AnimatePresence>
                        {showDeleteFor === book.id && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 10 }}
                            onClick={(e) => handleDeleteLocalBook(e, book.id)}
                            className="p-1.5 bg-red-950/90 text-red-400 rounded-md hover:bg-red-900 hover:text-red-300 transition-colors backdrop-blur-md border border-red-900/50 shadow-sm"
                            title="Delete Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                      <button
                        onClick={(e) => toggleDelete(e, book.id)}
                        className={`p-1.5 rounded-md transition-colors backdrop-blur-md border shadow-sm
                          ${showDeleteFor === book.id 
                            ? 'bg-zinc-800 text-zinc-200 border-zinc-700' 
                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 opacity-0 group-hover:opacity-100'
                          }
                        `}
                        title="Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    {progressMap[book.id] && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/80 backdrop-blur-sm">
                        <div 
                          className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                          style={{ width: `${(progressMap[book.id].currentIndex / progressMap[book.id].totalItems) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-200 leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">Local Vault</p>
                  </div>
                </motion.div>
              ))}

              {/* Curated Books */}
              {catalog.map((book, i) => (
                <motion.div
                  key={book.id || i}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleBookClick(book)}
                  className="group cursor-pointer flex flex-col gap-3"
                >
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 relative shadow-lg shadow-black/50">
                    {book.coverUrl ? (
                      <img 
                        src={book.coverUrl} 
                        alt={book.title} 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <BookOpen className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Progress Bar */}
                    {progressMap[book.textUrl] && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/80 backdrop-blur-sm">
                        <div 
                          className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                          style={{ width: `${(progressMap[book.textUrl].currentIndex / progressMap[book.textUrl].totalItems) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-200 leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{book.author}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <input
          type="file"
          accept="application/pdf,text/plain"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm bg-red-950/30 p-4 rounded-lg border border-red-900/50 text-center"
          >
            {error}
          </motion.p>
        )}
      </div>
    </div>
  );
}
