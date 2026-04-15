import React, { useState } from 'react';
import { Gateway } from './components/Gateway';
import { Reader } from './components/Reader';

export type SourceType = 'cloud-txt' | 'local-file' | 'local-db';

export default function App() {
  const [source, setSource] = useState<string | File | null>(null);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');

  const handleDocumentSelected = (src: string | File, type: SourceType, name: string, fType?: string) => {
    setSource(src);
    setSourceType(type);
    setFilename(name);
    if (fType) setFileType(fType);
  };

  const handleBack = () => {
    setSource(null);
    setSourceType(null);
    setFilename('');
    setFileType('');
  };

  return (
    <>
      {!source ? (
        <Gateway onDocumentSelected={handleDocumentSelected} />
      ) : (
        <Reader 
          source={source} 
          sourceType={sourceType!}
          filename={filename} 
          fileType={fileType}
          onBack={handleBack} 
        />
      )}
    </>
  );
}
