#!/usr/bin/env node
/**
 * main.js – Convert a fixed PDF into one tall PNG, send it to Gemini, and print the model’s reply.
 *
 * Configuration:  edit the constants just below.
 *
 *   npm install pdf-to-img sharp @google/genai
 */
require('dotenv').config();
const path = require("path");
const sharp = require("sharp");

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 CONFIGURABLE CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────
const PDF_PATH = "q292.pdf";                 // <– path to the PDF you want analysed
const PROMPT   = "This is an environmental report. Can you summarize what the image depicts?"; // <– what you want Gemini to do

// Derived output location (not shown to the user)
const OUTPUT_IMG = path.join(
  process.cwd(),
  `${path.parse(PDF_PATH).name}.png`
);

// ──────────────────────────────────────────────────────────────────────────────
// 1. Convert PDF pages → single PNG
// ──────────────────────────────────────────────────────────────────────────────
async function pdfToLongImage(pdfPath, outPath) {
  const { pdf } = await import("pdf-to-img"); // ESM dynamic import

  const doc = await pdf(pdfPath, { scale: 3 });
  const pages = [];
  const sizes = [];

  for await (const page of doc) {
    pages.push(page);
    const meta = await sharp(page).metadata();
    sizes.push({ w: meta.width, h: meta.height });
  }
  if (!pages.length) throw new Error("PDF has no pages.");

  const maxW = Math.max(...sizes.map(s => s.w));
  const totH = sizes.reduce((sum, s) => sum + s.h, 0);

  let y = 0;
  const composites = pages.map((buf, i) => ({ input: buf, left: 0, top: (y += i ? sizes[i-1].h : 0) }));

  await sharp({
    create: { width: maxW, height: totH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  return outPath;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Upload PNG to Gemini and get a response
// ──────────────────────────────────────────────────────────────────────────────
async function queryGeminiWithImage(imagePath, prompt) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = await import("@google/genai");
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Set GOOGLE_API_KEY in your env");

  const ai = new GoogleGenAI({ apiKey });
  const file = await ai.files.upload({ file: imagePath, config: { mimeType: "image/png" } });

  const contents = createUserContent([
    createPartFromUri(file.uri, file.mimeType),
    prompt,
  ]);

  const res = await ai.models.generateContent({ model: "gemini-2.0-flash", contents });
  return res.text;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Run the pipeline
// ──────────────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await pdfToLongImage(PDF_PATH, OUTPUT_IMG);
    const reply = await queryGeminiWithImage(OUTPUT_IMG, PROMPT);
    console.log(reply); // ← ONLY the Gemini output is printed
  } catch (err) {
    console.error("❌  Error:", err.message);
    process.exit(1);
  }
})();
