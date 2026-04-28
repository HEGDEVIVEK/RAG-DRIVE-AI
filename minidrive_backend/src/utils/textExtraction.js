const path = require("path");
const mammoth = require("mammoth");
const Papa = require("papaparse");
const XLSX = require("xlsx");
const { GetObjectCommand } = require("@aws-sdk/client-s3");

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadFileFromS3(s3Client, bucket, s3Key) {
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: s3Key })
  );
  return streamToBuffer(res.Body);
}

let pdfjsLib;
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib = mod;
  return pdfjsLib;
}

async function extractTextFromPdfBuffer(buffer) {
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText.trim();
}

function getExt(filename = "") {
  return path.extname(filename).toLowerCase().replace(".", "");
}

async function extractTextFromDocxBuffer(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

function extractTextFromCsvBuffer(buffer) {
  const csv = buffer.toString("utf8");
  const parsed = Papa.parse(csv, { skipEmptyLines: true });
  const rows = parsed.data || [];
  return rows.map((r) => (Array.isArray(r) ? r.join(" | ") : String(r))).join("\n").trim();
}

function extractTextFromXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) parts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
  }
  return parts.join("\n\n").trim();
}

async function extractTextFromFileBuffer({ buffer, filename, mimeType }) {
  const ext = getExt(filename);
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || ext === "pdf") return extractTextFromPdfBuffer(buffer);
  if (mt.includes("officedocument.wordprocessingml") || ext === "docx") return extractTextFromDocxBuffer(buffer);
  if (mt.includes("csv") || ext === "csv") return extractTextFromCsvBuffer(buffer);
  if (mt.includes("officedocument.spreadsheetml") || ext === "xlsx") return extractTextFromXlsxBuffer(buffer);
  if (mt.startsWith("text/") || ["txt", "md", "log"].includes(ext)) return buffer.toString("utf8").trim();

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

async function downloadAndExtractText({ s3Client, bucket, s3Key, filename, mimeType }) {
  console.log({ s3Key, filename, mimeType })
  const buffer = await downloadFileFromS3(s3Client, bucket, s3Key);
  console.log(buffer)
  const text = await extractTextFromFileBuffer({ buffer, filename, mimeType });
  return { buffer, text };
}

module.exports = {
  streamToBuffer,
  downloadFileFromS3,
  extractTextFromFileBuffer,
  downloadAndExtractText,
};