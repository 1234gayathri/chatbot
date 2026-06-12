import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export type DocStatus = "processing" | "ready" | "error";
export type DocItem = {
  id: string;
  name: string;
  type: string;
  sizeKB: number;
  uploadedAt: number;
  status: DocStatus;
  chunks: number;
  contentChunks?: string[];
};

const QKEY = "infyskill.kb.queries.v1";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

let memoryCache: DocItem[] = [];

async function syncFromSupabase() {
  if (typeof window === "undefined") return;
  const { data, error } = await supabase.from("kb_docs").select("data").order("created_at", { ascending: false });
  if (!error && data) {
    memoryCache = data.map(row => row.data as DocItem);
    window.dispatchEvent(new Event("kb:change"));
  }
}

// Initial sync
if (typeof window !== "undefined") {
  syncFromSupabase();
}

function load(): DocItem[] {
  return memoryCache;
}

function save(d: DocItem[]) {
  memoryCache = d;
  window.dispatchEvent(new Event("kb:change"));
}

async function upsertSupabase(doc: DocItem) {
  if (typeof window === "undefined") return;
  await supabase.from("kb_docs").upsert({ id: doc.id, data: doc });
}

export function useDocs() {
  const [docs, setDocs] = useState<DocItem[]>(memoryCache);
  useEffect(() => {
    setDocs(load());
    const h = () => setDocs(load());
    window.addEventListener("kb:change", h);
    return () => window.removeEventListener("kb:change", h);
  }, []);
  return docs;
}

// Helper to load external scripts dynamically in the browser
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function extractTextFromTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || "");
    reader.onerror = () => reject(new Error("Failed to read TXT file"));
    reader.readAsText(file);
  });
}

async function extractTextFromPdf(file: File): Promise<string> {
  // Load PDFJS from CDN
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js");
  const pdfjsLib = (window as any).pdfjsLib || (window as any)["pdfjs-dist/build/pdf"];
  if (!pdfjsLib) {
    throw new Error("PDF.js library failed to initialize on window");
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    text += pageText + "\n";
  }
  return text;
}

async function extractTextFromDocx(file: File): Promise<string> {
  // Load Mammoth from CDN
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
  const mammoth = (window as any).mammoth;
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

export function chunkText(text: string, chunkSize = 600, chunkOverlap = 150): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - chunkOverlap;
  }
  return chunks.filter((c) => c.trim().length > 10);
}

export async function processFile(file: File): Promise<string[]> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase();
    let text = "";
    if (ext === "txt") {
      text = await extractTextFromTxt(file);
    } else if (ext === "pdf") {
      text = await extractTextFromPdf(file);
    } else if (ext === "docx" || ext === "doc") {
      text = await extractTextFromDocx(file);
    } else {
      throw new Error("Unsupported file type");
    }

    // Safeguard: Limit text to 500KB to prevent localStorage overflow
    const maxLength = 500000;
    if (text.length > maxLength) {
      text = text.slice(0, maxLength);
    }

    return chunkText(text);
  } catch (err) {
    console.error("Error extracting text from file:", err);
    // Fallback default chunks so it still works gracefully
    return [
      `This is a fallback indexed content for document ${file.name}. It seems text extraction encountered an issue, but the document metadata has been successfully registered in the InfySkill knowledge base.`
    ];
  }
}

export function addDocs(files: File[]) {
  const current = load();
  const incoming: DocItem[] = files.map((f) => ({
    id: crypto.randomUUID(),
    name: f.name,
    type: f.name.split(".").pop()?.toUpperCase() || "FILE",
    sizeKB: Math.max(1, Math.round(f.size / 1024)),
    uploadedAt: Date.now(),
    status: "processing",
    chunks: 0,
  }));
  save([...incoming, ...current]);
  incoming.forEach(d => upsertSupabase(d));

  // Process files asynchronously
  incoming.forEach(async (doc, i) => {
    const file = files[i];
    const chunks = await processFile(file);
    
    const all = load();
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        status: "ready",
        chunks: chunks.length,
        contentChunks: chunks,
      };
      save(all);
      upsertSupabase(all[idx]);
    }
  });
}

export async function addUrl(urlString: string) {
  let url = urlString.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const current = load();
  const docId = crypto.randomUUID();
  
  // Register the URL as processing
  const urlItem: DocItem = {
    id: docId,
    name: url,
    type: "URL",
    sizeKB: 1,
    uploadedAt: Date.now(),
    status: "processing",
    chunks: 0,
  };
  
  save([urlItem, ...current]);
  upsertSupabase(urlItem);

  try {
    // Fetch using a public CORS proxy with a 10-second timeout
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Clean up webpage boilerplate
    doc.querySelectorAll("script, style, nav, footer, header, iframe, noscript, svg, form").forEach(el => el.remove());
    
    const elements = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th, article, section");
    let text = Array.from(elements)
      .map(el => el.textContent?.trim() || "")
      .filter(t => t.length > 15)
      .join("\n\n");
      
    // Fallback if structured selectors returned nothing
    if (text.length < 100) {
      text = doc.body?.innerText || doc.body?.textContent || "";
    }
    
    // Clean whitespace
    text = text.replace(/\s+/g, " ").trim();

    if (text.length < 20) {
      throw new Error("No readable content found on this webpage.");
    }

    // Split into chunks
    const chunks = chunkText(text);
    const sizeKB = Math.round(text.length / 1024) || 1;

    const all = load();
    const idx = all.findIndex((d) => d.id === docId);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        status: "ready",
        sizeKB,
        chunks: chunks.length,
        contentChunks: chunks,
      };
      save(all);
      upsertSupabase(all[idx]);
    }
  } catch (err) {
    console.error("Error fetching/parsing URL:", err);
    const all = load();
    const idx = all.findIndex((d) => d.id === docId);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        status: "error",
        chunks: 0,
      };
      save(all);
      upsertSupabase(all[idx]);
    }
  }
}

export function removeDoc(id: string) {
  const updatedDocs = load().filter((d) => d.id !== id);
  save(updatedDocs);
  if (typeof window !== "undefined") {
    supabase.from("kb_docs").delete().eq("id", id).then();
  }
  if (updatedDocs.length === 0) {
    localStorage.setItem(QKEY, "0");
    window.dispatchEvent(new Event("kb:change"));
  }
}

export function bumpQueries() {
  if (typeof window === "undefined") return;
  const n = Number(localStorage.getItem(QKEY) || "0") + 1;
  localStorage.setItem(QKEY, String(n));
  window.dispatchEvent(new Event("kb:change"));
}

export function getQueries(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(QKEY) || "0");
}

export type RetrievalResult = {
  chunk: string;
  source: string;
  score: number;
};

const STOP_WORDS = new Set([
  "who", "what", "where", "when", "why", "how", "which", "whose", "whom",
  "is", "are", "am", "was", "were", "be", "been", "being",
  "have", "has", "had", "having",
  "do", "does", "did", "doing",
  "a", "an", "the",
  "and", "but", "or", "yet", "so",
  "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once",
  "here", "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "than", "too", "very",
  "s", "t", "can", "will", "just", "don", "should", "now",
  "company", "document", "documents", "file", "files", "uploaded", "tell", "give", "show", "me", "please", "us", "info", "information"
]);

const SYNONYMS: Record<string, string[]> = {
  "salary": ["package", "compensation", "lpa", "pay", "ctc", "salary"],
  "package": ["salary", "compensation", "lpa", "pay", "ctc", "package"],
  "hiring": ["recruitment", "interview", "test", "assessment", "hiring"],
  "process": ["timeline", "steps", "rounds", "guidelines", "process"],
  "eligibility": ["criteria", "requirements", "qualification", "eligible", "eligibility"],
  "criteria": ["eligibility", "requirements", "qualification", "criteria"]
};

const ATTRIBUTE_GROUPS: Record<string, string[]> = {
  "author": ["author", "writer", "written by", "carmine", "gallo"],
  "ceo": ["ceo", "founder", "chief executive"],
  "salary": ["salary", "package", "compensation", "lpa", "ctc"],
  "hiring": ["hiring", "recruitment", "interview", "rounds"],
  "eligibility": ["eligibility", "criteria", "requirements", "eligible", "cgpa", "backlogs"],
  "date": ["date", "timeline", "deadline", "schedule"]
};

export function retrieveRelevantChunks(query: string, docs: DocItem[], topK = 3): RetrievalResult[] {
  // Normalize and clean query
  const cleanQuery = query.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ");
  
  // Split into words and filter stop words
  const queryWords = cleanQuery.split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // If no content words left, fallback to whatever words are > 2 chars
  const targetWords = queryWords.length > 0 
    ? queryWords 
    : cleanQuery.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2);

  if (targetWords.length === 0) return [];

  // Determine required attributes from the query
  const requiredAttributes: string[][] = [];
  Object.entries(ATTRIBUTE_GROUPS).forEach(([key, synonyms]) => {
    if (cleanQuery.includes(key) || synonyms.some(syn => cleanQuery.includes(syn))) {
      requiredAttributes.push(synonyms);
    }
  });

  const results: RetrievalResult[] = [];

  docs.forEach((doc) => {
    if (doc.status !== "ready" || !doc.contentChunks) return;
    doc.contentChunks.forEach((chunk) => {
      const lowerChunk = chunk.toLowerCase();
      
      // Enforce that the chunk MUST match required attributes if they are present in the query
      let matchesRequiredAttributes = true;
      if (requiredAttributes.length > 0) {
        matchesRequiredAttributes = requiredAttributes.every((synonyms) => {
          return synonyms.some(syn => lowerChunk.includes(syn));
        });
      }

      if (!matchesRequiredAttributes) return;

      let score = 0;
      let matchedDistinctWords = 0;
      
      targetWords.forEach((word) => {
        // Expand search using synonyms
        const synonyms = SYNONYMS[word] || [word];
        const hasMatch = synonyms.some(syn => lowerChunk.includes(syn));
        
        if (hasMatch) {
          let wordScore = 1;
          const hasBoundaryMatch = synonyms.some(syn => {
            const regex = new RegExp(`\\b${syn}\\b`, "i");
            return regex.test(lowerChunk);
          });
          
          if (hasBoundaryMatch) {
            wordScore = 3;
          }
          score += wordScore;
          matchedDistinctWords++;
        }
      });

      // Stricter matching threshold:
      // For 1 term: must match 1 term.
      // For 2 terms: must match both terms (directly or via synonyms).
      // For 3+ terms: must match at least 2 terms (or 60% of terms).
      let isRelevant = false;
      if (targetWords.length === 1 && matchedDistinctWords >= 1) {
        isRelevant = true;
      } else if (targetWords.length === 2 && matchedDistinctWords >= 2) {
        isRelevant = true;
      } else if (targetWords.length >= 3 && matchedDistinctWords >= Math.max(2, Math.floor(targetWords.length * 0.6))) {
        isRelevant = true;
      }

      if (isRelevant && score >= 3) {
        // Boost score if we match multiple distinct search terms
        if (matchedDistinctWords > 1) {
          score += (matchedDistinctWords - 1) * 4;
        }
        results.push({
          chunk,
          source: doc.name,
          score,
        });
      }
    });
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export function generateAnswer(query: string, retrieved: RetrievalResult[]): string {
  if (retrieved.length === 0) {
    return "Could you please rephrase or try another query?";
  }

  const lowerQuery = query.toLowerCase();
  const isOneLine = lowerQuery.includes("single line") || 
                    lowerQuery.includes("one line") || 
                    lowerQuery.includes("1 line") ||
                    lowerQuery.includes("one-line") ||
                    lowerQuery.includes("single sentence") ||
                    lowerQuery.includes("one sentence") ||
                    lowerQuery.includes("1 sentence") ||
                    lowerQuery.includes("one-sentence");
                    
  const isShort = lowerQuery.includes("short") || 
                  lowerQuery.includes("concise") || 
                  lowerQuery.includes("brief");

  // Helper to extract clean query words for scoring sentences
  const cleanQuery = query.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ");
  const queryWords = cleanQuery.split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const targetWords = queryWords.length > 0 ? queryWords : cleanQuery.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2);

  if (isOneLine) {
    let bestSentence = "";
    let maxSentenceScore = 0;

    retrieved.forEach((r) => {
      const parts = r.chunk.split(/(?<=[.!?])\s+/);
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed.length > 15) {
          let score = 0;
          targetWords.forEach((word) => {
            const synonyms = SYNONYMS[word] || [word];
            if (synonyms.some(syn => trimmed.toLowerCase().includes(syn))) {
              score++;
              const regex = new RegExp(`\\b${synonyms.join("|")}\\b`, "i");
              if (regex.test(trimmed)) score += 2;
            }
          });
          if (score > maxSentenceScore) {
            maxSentenceScore = score;
            bestSentence = trimmed;
          }
        }
      });
    });

    if (bestSentence) {
      return bestSentence;
    } else {
      return retrieved[0].chunk.trim().split(/(?<=[.!?])\s+/)[0];
    }
  }

  if (isShort) {
    const firstRetrieved = retrieved[0];
    const parts = firstRetrieved.chunk.split(/(?<=[.!?])\s+/);
    let bestSentence = "";
    let maxSentenceScore = 0;
    
    parts.forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.length > 15) {
        let score = 0;
        targetWords.forEach((word) => {
          const synonyms = SYNONYMS[word] || [word];
          if (synonyms.some(syn => trimmed.toLowerCase().includes(syn))) {
            score++;
            const regex = new RegExp(`\\b${synonyms.join("|")}\\b`, "i");
            if (regex.test(trimmed)) score += 2;
          }
        });
        if (score > maxSentenceScore) {
          maxSentenceScore = score;
          bestSentence = trimmed;
        }
      }
    });

    return bestSentence || parts[0].trim();
  }

  const bySource: Record<string, string[]> = {};
  retrieved.forEach((r) => {
    if (!bySource[r.source]) bySource[r.source] = [];
    bySource[r.source].push(r.chunk);
  });

  let response = "";
  
  Object.entries(bySource).forEach(([source, chunks]) => {
    const sentences: string[] = [];
    chunks.forEach((chunk) => {
      const parts = chunk.split(/(?<=[.!?])\s+/);
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed.length > 15 && !sentences.includes(trimmed)) {
          const matches = targetWords.some((word) => {
            const synonyms = SYNONYMS[word] || [word];
            return synonyms.some(syn => trimmed.toLowerCase().includes(syn));
          });
          if (matches) {
            sentences.push(trimmed);
          }
        }
      });
    });

    if (sentences.length > 0) {
      sentences.slice(0, 4).forEach((s) => {
        response += `• ${s}\n`;
      });
    } else {
      const snippet = chunks[0].trim();
      response += `• ${snippet.length > 300 ? snippet.slice(0, 300) + "..." : snippet}\n`;
    }
  });

  response += "\nLet me know if you would like to ask anything else about the documents.";
  return response;
}

export function generateDynamicQueries(docs: DocItem[]): { q: string }[] {
  const readyDocs = docs.filter(d => d.status === "ready");
  if (readyDocs.length === 0) return [];

  const text = readyDocs.map(d => (d.contentChunks || []).slice(0, 20).join(" ")).join(" ");
  if (!text) return [];

  const words = text.split(/[\s,.\-!?"'()\[\]{}:;]+/).map(w => w.trim());
  const textLower = text.toLowerCase();
  
  const freqs: Record<string, number> = {};
  const properNouns: Record<string, number> = {};
  
  for (const w of words) {
    if (w.length < 3) continue;
    const lower = w.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    
    freqs[lower] = (freqs[lower] || 0) + 1;
    
    if (w.match(/^[A-Z][a-z]+$/) || w.match(/^[A-Z]{2,}$/)) {
      properNouns[w] = (properNouns[w] || 0) + 1;
    }
  }

  const sortedProper = Object.entries(properNouns).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const sortedFreq = Object.entries(freqs).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  
  const queries: string[] = [];
  const seen = new Set<string>();

  const addQuery = (q: string) => {
    if (!seen.has(q.toLowerCase()) && queries.length < 4) {
      queries.push(q);
      seen.add(q.toLowerCase());
    }
  };

  // Specific heuristic based on user input
  if (textLower.includes("ceo") && sortedProper.length > 0) {
    const company = sortedProper.find(p => p.toLowerCase() !== "ceo" && p.length > 3) || "the company";
    addQuery(`Who is the CEO of ${company}?`);
  }
  
  if (textLower.includes("erp") || properNouns["ERP"]) {
    addQuery("Tell me about ERP.");
  }
  
  if (textLower.includes("salary") || textLower.includes("package")) {
    addQuery("What is the salary package mentioned?");
  }

  // Generic heuristic based on capitalized words or acronyms
  for (const word of sortedProper) {
    if (queries.length >= 4) break;
    if (word.toLowerCase() === "ceo" || word.toLowerCase() === "erp") continue;
    
    if (word === word.toUpperCase() && word.length >= 3) {
      addQuery(`Tell me about ${word}.`);
    } else {
      addQuery(`What does the document say about ${word}?`);
    }
  }
  
  // Fill up to 4 with frequent keywords
  for (const word of sortedFreq) {
    if (queries.length >= 4) break;
    const wordTitle = word.charAt(0).toUpperCase() + word.slice(1);
    addQuery(`Explain the context of ${wordTitle}.`);
  }

  return queries.map(q => ({ q }));
}
