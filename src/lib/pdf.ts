import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Use the local worker bundled by Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';
    }

    // Clean the extracted text
    const cleanedText = fullText
      .replace(/-\n/g, '')        // Fix hyphenated line breaks
      .replace(/\n/g, ' ')        // Replace all newlines with a space
      .replace(/\s{2,}/g, ' ')    // Collapse multiple spaces into a single space
      .replace(/[^\x20-\x7E]/g, '') // Strip weird non-ASCII formatting characters
      .trim();

    return cleanedText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
}
