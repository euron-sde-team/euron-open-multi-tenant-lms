/**
 * Extract text content from supported file types for AI context.
 * Supports .txt, .md, .csv, .json (FileReader) and .pdf (pdfjs via react-pdf).
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const TEXT_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
];
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const PDF_MIME = "application/pdf";
const PDF_EXTENSION = ".pdf";

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function isTextFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    TEXT_EXTENSIONS.includes(ext) ||
    TEXT_MIME_TYPES.some((m) => file.type === m)
  );
}

function isPdfFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ext === PDF_EXTENSION || file.type === PDF_MIME;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file, "UTF-8");
  });
}

let pdfjsWorkerInitialized = false;

async function ensurePdfJsWorker(): Promise<void> {
  if (pdfjsWorkerInitialized) return;
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfjsWorkerInitialized = true;
}

async function extractTextFromPdf(file: File): Promise<string> {
  await ensurePdfJsWorker();
  const { pdfjs } = await import("react-pdf");
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = doc.numPages;
  const chunks: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    chunks.push(pageText);
  }

  return chunks.join("\n\n");
}

/**
 * Extract text from a file. Supports .txt, .md, .csv, .json, and .pdf.
 * @param file - The file to extract text from
 * @param maxSizeBytes - Max file size in bytes (default 5MB). Throws if exceeded.
 * @returns The extracted text content
 * @throws Error if file type is unsupported, file is too large, or extraction fails
 */
export async function extractTextFromFile(
  file: File,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): Promise<string> {
  if (file.size > maxSizeBytes) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum ${maxSizeBytes / 1024 / 1024}MB`
    );
  }

  if (isTextFile(file)) {
    return readFileAsText(file);
  }

  if (isPdfFile(file)) {
    return extractTextFromPdf(file);
  }

  throw new Error(
    `Unsupported file type. Allowed: ${[...TEXT_EXTENSIONS, PDF_EXTENSION].join(", ")}`
  );
}

export { MAX_FILE_SIZE_BYTES };
