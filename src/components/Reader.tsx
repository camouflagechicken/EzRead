import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Settings, ArrowLeft, ArrowDownCircle, Volume2, Gauge, Activity, PanelRight, PanelLeft, Loader2, Focus, Type, MoveHorizontal } from 'lucide-react';
import { TTSEngine } from '../lib/tts';
import { extractTextFromPDF } from '../lib/pdf';
import { motion, AnimatePresence } from 'motion/react';
import type { SourceType } from '../App';
import { StorageService } from '../services/StorageService';

interface ReaderProps {
  source: string | File;
  sourceType: SourceType;
  filename: string;
  fileType?: string;
  onBack: () => void;
}

type PlaybackState = 'playing' | 'paused' | 'stopped';

export function Reader({ source, sourceType, filename, fileType, onBack }: ReaderProps) {
  const [documentText, setDocumentText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showToc, setShowToc] = useState(false);
  
  // Typographic & Focus state
  const [fontSize, setFontSize] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 18 : 24);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Personalization state
  const [volume, setVolume] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);

  // Auto-scroll interruption state
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLParagraphElement>(null);

  // Data Ingestion Phase
  useEffect(() => {
    let isMounted = true;
    
    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Load global settings first
        const settings = await StorageService.getSettings();
        if (settings && isMounted) {
          setFontSize(settings.fontSize);
          setContainerWidth(settings.containerWidth);
          setIsFocusMode(settings.isFocusMode);
          setVolume(settings.volume);
          setRate(settings.rate);
          setPitch(settings.pitch);
          if (settings.selectedVoiceURI) {
            setSelectedVoiceURI(settings.selectedVoiceURI);
          }
        }

        let text = '';
        if (sourceType === 'cloud-txt' && typeof source === 'string') {
          const res = await fetch(source);
          if (!res.ok) throw new Error("Failed to fetch book text from the cloud.");
          text = await res.text();
        } else if (sourceType === 'local-file' && source instanceof File) {
          if (source.type === 'application/pdf') {
            text = await extractTextFromPDF(source);
          } else {
            text = await source.text();
          }
        } else if (sourceType === 'local-db' && typeof source === 'string') {
          const bookData = await StorageService.getBookData(source);
          if (!bookData) throw new Error("Book not found in local vault.");
          
          if (bookData.fileType === 'pdf') {
            // Convert base64 back to File
            const binaryString = atob(bookData.fileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const file = new File([bytes], filename, { type: 'application/pdf' });
            text = await extractTextFromPDF(file);
          } else {
            text = bookData.fileData;
          }
        }
        
        if (!text) throw new Error("No text could be extracted.");
        
        if (isMounted) {
          setDocumentText(text);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load document.");
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [source, sourceType, filename]);

  // Split text into sentences
  const sentences = useMemo(() => {
    if (!documentText) return [];
    // Basic sentence splitting by punctuation
    const matches = documentText.match(/[^.!?]+[.!?]+/g);
    if (matches && matches.length > 0) {
      return matches.map(s => s.trim()).filter(s => s.length > 0);
    }
    return [documentText];
  }, [documentText]);

  // Load progress on mount
  useEffect(() => {
    if (sentences.length === 0) return;
    const bookId = typeof source === 'string' ? source : filename;
    
    StorageService.getProgress(bookId).then(progress => {
      if (progress && progress.currentIndex < sentences.length) {
        setActiveSentenceIndex(progress.currentIndex);
        // Scroll to it immediately
        setTimeout(() => {
          if (activeSentenceRef.current) {
            activeSentenceRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }, 100);
      }
    });
  }, [sentences, source, filename]);

  // Save progress on change
  useEffect(() => {
    if (sentences.length === 0) return;
    const bookId = typeof source === 'string' ? source : filename;
    
    const timeoutId = setTimeout(() => {
      StorageService.saveProgress(bookId, activeSentenceIndex, sentences.length).catch(console.error);
    }, 1000); // Debounce saves
    
    return () => clearTimeout(timeoutId);
  }, [activeSentenceIndex, sentences.length, source, filename]);

  // Save settings on change
  useEffect(() => {
    // Skip saving if we haven't loaded yet
    if (isLoading) return;

    const timeoutId = setTimeout(() => {
      StorageService.saveSettings({
        fontSize,
        containerWidth,
        isFocusMode,
        volume,
        rate,
        pitch,
        selectedVoiceURI
      }).catch(console.error);
    }, 500); // Debounce saves

    return () => clearTimeout(timeoutId);
  }, [fontSize, containerWidth, isFocusMode, volume, rate, pitch, selectedVoiceURI, isLoading]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = TTSEngine.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoiceURI) {
        // Try to find a good default English voice
        const defaultVoice = availableVoices.find(v => v.name === 'Google UK English Male')
                          || availableVoices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
                          || availableVoices.find(v => v.lang.startsWith('en')) 
                          || availableVoices[0];
        setSelectedVoiceURI(defaultVoice.voiceURI);
      }
    };

    loadVoices();
    // Chrome loads voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      TTSEngine.stop();
    };
  }, []);

  // Handle scroll events to detect user interruption
  const handleScroll = () => {
    if (playbackState === 'playing') {
      setIsUserScrolling(true);
      
      // Reset the timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // If user stops scrolling for 3 seconds, we could auto-resume tracking,
      // but the spec says "adds an arrow to go back down to auto play", 
      // so we'll keep it manual until they click the arrow or a sentence.
    }
  };

  const scrollToActive = () => {
    setIsUserScrolling(false);
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  // Auto-scroll to active sentence when it changes, IF user isn't scrolling
  useEffect(() => {
    if (!isUserScrolling && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex, isUserScrolling]);

  const handleMinimapClick = (index: number) => {
    setIsUserScrolling(true);
    const element = document.querySelector(`p[data-index="${index}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const progressPercent = sentences.length > 0 ? Math.round((activeSentenceIndex / sentences.length) * 100) : 0;

  const tocItems = useMemo(() => {
    const items: { title: string, index: number }[] = [];
    
    const isRomanNumeral = (str: string) => {
      return /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(str) && str.length > 0;
    };

    const isSpelledNumber = (str: string) => {
      return /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$/i.test(str);
    };

    sentences.forEach((s, index) => {
      // 1. Look for explicit chapter/part markers anywhere in the sentence
      const explicitMatch = s.match(/\b(chapter|part|section|book|volume)\s+([0-9]+|[a-z]+)\b/i);
      if (explicitMatch) {
        const word = explicitMatch[2];
        if (/^[0-9]+$/.test(word) || isRomanNumeral(word) || isSpelledNumber(word)) {
          const title = `${explicitMatch[1]} ${word}`.toUpperCase();
          // Avoid adding duplicates if they appear in quick succession
          if (!items.find(i => i.title === title && Math.abs(i.index - index) < 5)) {
            items.push({ title, index });
          }
          return;
        }
      } 
      
      // 2. Look for standalone Roman numerals or numbers in short sentences
      if (s.length < 40) {
        const trimmed = s.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (/^[0-9]+$/.test(trimmed) || isRomanNumeral(trimmed)) {
          // Avoid matching the word "I" unless it has punctuation (like "I.")
          if (trimmed.toLowerCase() !== 'i' || s.includes('.')) {
            items.push({ title: `Part ${trimmed.toUpperCase()}`, index });
          }
        }
      }
    });
    return items;
  }, [sentences]);

  const currentChapter = useMemo(() => {
    // Find the last tocItem that is at or before the activeSentenceIndex
    for (let i = tocItems.length - 1; i >= 0; i--) {
      if (tocItems[i].index <= activeSentenceIndex) {
        return tocItems[i].title;
      }
    }
    return null;
  }, [activeSentenceIndex, tocItems]);

  const selectedVoice = useMemo(() => {
    return voices.find(v => v.voiceURI === selectedVoiceURI) || null;
  }, [voices, selectedVoiceURI]);

  // State Ref for callbacks
  const stateRef = useRef({
    sentences,
    selectedVoice,
    volume,
    rate,
    pitch,
    playbackState,
    activeSentenceIndex
  });

  useEffect(() => {
    stateRef.current = {
      sentences,
      selectedVoice,
      volume,
      rate,
      pitch,
      playbackState,
      activeSentenceIndex
    };
  });

  const playSentence = React.useCallback((index: number) => {
    const { sentences, selectedVoice, volume, rate, pitch } = stateRef.current;

    if (index >= sentences.length) {
      setPlaybackState('stopped');
      return;
    }

    setActiveSentenceIndex(index);
    setPlaybackState('playing');

    TTSEngine.speak(
      sentences[index],
      selectedVoice,
      volume,
      rate,
      pitch,
      () => {
        // On end, play next seamlessly
        if (stateRef.current.playbackState === 'playing') {
          // Use setTimeout to avoid deep call stacks
          setTimeout(() => playSentence(index + 1), 10);
        }
      },
      (e) => {
        // On error, just stop for now to avoid infinite loops
        setPlaybackState('stopped');
      }
    );
  }, []);

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      TTSEngine.pause();
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      TTSEngine.resume();
      setPlaybackState('playing');
      // If they paused while scrolling, snap back when they resume
      if (isUserScrolling) {
        scrollToActive();
      }
    } else {
      // Stopped
      setIsUserScrolling(false);
      playSentence(activeSentenceIndex);
    }
  };

  const handleStop = () => {
    TTSEngine.stop();
    setPlaybackState('stopped');
  };

  const handleNext = () => {
    const nextIdx = Math.min(activeSentenceIndex + 1, sentences.length - 1);
    setActiveSentenceIndex(nextIdx);
    if (playbackState === 'playing') {
      playSentence(nextIdx);
    }
  };

  const handlePrev = () => {
    const prevIdx = Math.max(activeSentenceIndex - 1, 0);
    setActiveSentenceIndex(prevIdx);
    if (playbackState === 'playing') {
      playSentence(prevIdx);
    }
  };

  const handleSentenceClick = (index: number) => {
    setIsUserScrolling(false);
    setActiveSentenceIndex(index);
    playSentence(index);
  };

  // Ensure we stop TTS if component unmounts
  useEffect(() => {
    return () => {
      TTSEngine.stop();
    };
  }, []);

  // Restart sentence if settings change while playing
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (playbackState === 'playing') {
      playSentence(activeSentenceIndex);
    }
  }, [selectedVoiceURI, volume, rate, pitch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <Loader2 className="w-10 h-10 text-zinc-500 animate-spin mb-4" />
        <p className="text-zinc-400">Preparing document for neural playback...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <p className="text-red-400 mb-6 text-center max-w-md">{error}</p>
        <button 
          onClick={onBack} 
          className="px-6 py-2 bg-zinc-800 text-zinc-200 rounded-full hover:bg-zinc-700 transition-colors"
        >
          Return to Library
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans relative">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 z-10 relative">
        {/* Progress Bar */}
        <div 
          className="absolute top-0 left-0 h-0.5 bg-zinc-400 transition-all duration-500 ease-out" 
          style={{ width: `${progressPercent}%` }} 
        />
        
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => {
              handleStop();
              onBack();
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowToc(!showToc)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full transition-colors ${showToc ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}
            title="Toggle Table of Contents"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-xs">{filename}</h2>
            <p className="text-xs text-zinc-500">
              {currentChapter ? `${currentChapter} • ` : ''}
              {progressPercent}% • {activeSentenceIndex + 1} / {sentences.length}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setShowMinimap(!showMinimap)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${showMinimap ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}
            title="Toggle Minimap"
          >
            <PanelRight className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${showSettings ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${isFocusMode ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}
            title="Focus Mode"
          >
            <Focus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-900 border-b border-zinc-800 overflow-hidden z-10 absolute top-[73px] left-0 right-0 shadow-2xl"
          >
            <div className="p-6 max-w-3xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Voice Selection</label>
                <select 
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                >
                  {voices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col md:flex-row flex-wrap gap-6">
                <div className="space-y-3 flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-400"><Type className="w-4 h-4"/> Font Size</span>
                    <span className="text-zinc-300">{fontSize}px</span>
                  </div>
                  <input 
                    type="range" min="14" max="48" step="2" 
                    value={fontSize} 
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </div>

                <div className="space-y-3 flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-400"><MoveHorizontal className="w-4 h-4"/> Width</span>
                    <span className="text-zinc-300">{containerWidth}px</span>
                  </div>
                  <input 
                    type="range" min="400" max="1200" step="50" 
                    value={containerWidth} 
                    onChange={(e) => setContainerWidth(parseInt(e.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </div>

                <div className="space-y-3 flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-400"><Volume2 className="w-4 h-4"/> Volume</span>
                    <span className="text-zinc-300">{Math.round(volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={volume} 
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </div>

                <div className="space-y-3 flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-400"><Gauge className="w-4 h-4"/> Speed</span>
                    <span className="text-zinc-300">{rate.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2" step="0.1" 
                    value={rate} 
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </div>

                <div className="space-y-3 flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-400"><Activity className="w-4 h-4"/> Pitch</span>
                    <span className="text-zinc-300">{pitch.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2" step="0.1" 
                    value={pitch} 
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-zinc-300"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teleprompter Scroll Area & Panels */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Table of Contents (Left Panel) */}
        <AnimatePresence>
          {showToc && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowToc(false)}
              className="md:hidden absolute inset-0 bg-black/60 z-20 backdrop-blur-sm"
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {showToc && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute md:relative inset-y-0 left-0 z-30 border-r border-zinc-900 bg-zinc-950/95 md:bg-zinc-950/30 overflow-hidden shadow-2xl md:shadow-none backdrop-blur-xl md:backdrop-blur-none"
            >
              <div className="w-[85vw] max-w-[320px] md:w-64 lg:w-80 h-full overflow-y-auto p-6 custom-scrollbar select-none">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-6">Table of Contents</h3>
                {tocItems.length === 0 ? (
                  <p className="text-sm text-zinc-600">No chapters detected.</p>
                ) : (
                  <div className="space-y-1">
                    {tocItems.map((item, i) => {
                      const isPast = activeSentenceIndex >= item.index;
                      const isBeforeNext = i === tocItems.length - 1 || activeSentenceIndex < tocItems[i+1].index;
                      const isActive = isPast && isBeforeNext;
                      
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            handleMinimapClick(item.index);
                            if (window.innerWidth < 768) setShowToc(false);
                          }}
                          className={`
                            text-sm py-2 px-3 rounded-lg cursor-pointer transition-colors line-clamp-2
                            ${isActive ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'}
                          `}
                        >
                          {item.title}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Scroll Area */}
        <div 
          ref={containerRef}
          onWheel={handleScroll}
          onTouchMove={handleScroll}
          className="flex-1 overflow-y-auto scroll-smooth px-0 sm:px-12 md:px-24 lg:px-48 custom-scrollbar"
        >
          <div className="py-[40vh]" style={{ maxWidth: `${containerWidth}px`, width: '100%', margin: '0 auto', padding: '0 16px' }}>
            {sentences.map((sentence, index) => {
              const isActive = index === activeSentenceIndex;
              
              let textClasses = '';
              if (isActive) {
                textClasses = 'text-zinc-50 font-medium scale-[1.02] origin-left opacity-100 blur-none';
              } else if (isFocusMode) {
                textClasses = 'text-zinc-500 opacity-20 blur-[3px] hover:opacity-40 hover:blur-[1px]';
              } else {
                textClasses = 'text-zinc-500 opacity-60 hover:text-zinc-400 hover:opacity-100';
              }

              return (
                <p
                  key={index}
                  data-index={index}
                  ref={isActive ? activeSentenceRef : null}
                  onClick={() => handleSentenceClick(index)}
                  style={{ 
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.6,
                    marginBottom: '1.5em'
                  }}
                  className={`
                    font-serif cursor-pointer transition-all duration-300
                    ${textClasses}
                  `}
                >
                  {sentence}
                </p>
              );
            })}
          </div>
        </div>

        {/* Minimap */}
        <AnimatePresence>
          {showMinimap && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMinimap(false)}
              className="md:hidden absolute inset-0 bg-black/60 z-20 backdrop-blur-sm"
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {showMinimap && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute md:relative inset-y-0 right-0 z-30 border-l border-zinc-900 bg-zinc-950/95 md:bg-zinc-950/30 overflow-hidden shadow-2xl md:shadow-none backdrop-blur-xl md:backdrop-blur-none"
            >
              <div className="w-[85vw] max-w-[320px] md:w-72 lg:w-96 h-full overflow-y-auto p-6 custom-scrollbar select-none">
                <div className="py-[40vh]">
                  {sentences.map((sentence, index) => {
                    const isActive = index === activeSentenceIndex;
                    return (
                      <div
                        key={index}
                        onClick={() => {
                          handleMinimapClick(index);
                          if (window.innerWidth < 768) setShowMinimap(false);
                        }}
                        className={`
                          text-[10px] leading-[16px] mb-2 cursor-pointer transition-colors line-clamp-3
                          ${isActive ? 'text-zinc-200 bg-zinc-800/80 rounded px-2 py-1.5 shadow-sm shadow-zinc-900/50' : 'text-zinc-700 hover:text-zinc-500'}
                        `}
                      >
                        {sentence}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Return to active sentence FAB */}
      <AnimatePresence>
        {isUserScrolling && playbackState === 'playing' && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={scrollToActive}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-zinc-100 text-zinc-950 px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-zinc-100/10 hover:scale-105 active:scale-95 transition-all z-20"
          >
            <ArrowDownCircle className="w-5 h-5" />
            Return to reading
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Control Bar */}
      <div className="bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900 pb-safe pt-3 px-6 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between pb-3">
          <div className="flex-1 flex justify-start">
            <button 
              onClick={handleStop}
              className="min-w-[44px] min-h-[44px] flex items-center justify-start text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button 
              onClick={handlePrev}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button 
              onClick={handlePlayPause}
              className="w-14 h-14 flex items-center justify-center bg-zinc-100 text-zinc-950 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-100/10"
            >
              {playbackState === 'playing' ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            <button 
              onClick={handleNext}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>
          
          <div className="flex-1 flex justify-end">
            {/* Empty spacer to balance the flex layout and keep play button centered */}
          </div>
        </div>
      </div>
    </div>
  );
}
