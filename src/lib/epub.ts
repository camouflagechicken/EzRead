import JSZip from 'jszip';

export async function extractTextFromEpub(file: File): Promise<string> {
    try {
        const zip = await JSZip.loadAsync(file);
        
        // Find container.xml to locate the OPF file
        const containerXmlFile = zip.file("META-INF/container.xml");
        if (!containerXmlFile) {
            throw new Error("Invalid EPUB: META-INF/container.xml missing");
        }
        
        const containerXmlText = await containerXmlFile.async("text");
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXmlText, "application/xml");
        const rootfileNode = containerDoc.querySelector("rootfile");
        if (!rootfileNode) {
            throw new Error("Invalid EPUB: No rootfile in container.xml");
        }
        
        const opfPath = rootfileNode.getAttribute("full-path");
        if (!opfPath) {
            throw new Error("Invalid EPUB: No full-path attribute in rootfile");
        }
        
        // Determine the base path of the OPF file
        const basePathMatch = opfPath.match(/(.*\/)/);
        const basePath = basePathMatch ? basePathMatch[1] : "";
        
        // Read OPF file
        const opfFile = zip.file(opfPath);
        if (!opfFile) {
            throw new Error("Invalid EPUB: OPF file not found");
        }
        
        const opfText = await opfFile.async("text");
        const opfDoc = parser.parseFromString(opfText, "application/xml");
        
        // Parse Manifest (ID -> File Path)
        const manifest = opfDoc.querySelector("manifest");
        if (!manifest) {
            throw new Error("Invalid EPUB: Missing manifest element");
        }
        
        const itemMap: Record<string, string> = {};
        const items = manifest.querySelectorAll("item");
        items.forEach(item => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            if (id && href) {
                // Keep paths relative to zip root by prepending base path
                // Some hrefs might be URI encoded
                itemMap[id] = basePath + decodeURI(href);
            }
        });
        
        // Parse Spine (Reading Order)
        const spine = opfDoc.querySelector("spine");
        if (!spine) {
            throw new Error("Invalid EPUB: Missing spine element");
        }
        
        const textParts: string[] = [];
        const itemrefs = spine.querySelectorAll("itemref");
        
        for (const itemref of Array.from(itemrefs)) {
            const idref = itemref.getAttribute("idref");
            if (!idref) continue;
            
            const filePath = itemMap[idref];
            if (!filePath) continue;
            
            const htmlFile = zip.file(filePath);
            if (!htmlFile) continue;
            
            const htmlContent = await htmlFile.async("text");
            const htmlDoc = parser.parseFromString(htmlContent, "text/html");
            const textContent = htmlDoc.body ? htmlDoc.body.textContent || "" : "";
            
            // Push text content, trimming excessive whitespace but keeping paragraphs separate
            const cleanedText = textContent
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .join('\n');
            
            if (cleanedText) {
                textParts.push(cleanedText);
            }
        }
        
        return textParts.join("\n\n");
    } catch (err) {
        console.error("EPUB Extraction Error:", err);
        throw new Error("Failed to extract text from EPUB.");
    }
}
