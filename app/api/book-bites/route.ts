import { NextRequest, NextResponse } from "next/server";
import { catalogue } from "../../../lib/catalogue";

const fallback = (title:string) => [
  `Meet ${title}: the essential premise in one clear, spoiler-free thought.`, "The invitation: what kind of reading mood this book creates.", "A tension or question worth noticing as you begin.", "A character, idea or setting to keep an eye on.", "The emotional weather of the book.", "One useful lens for relating the book to real life.", "What makes this title endure for readers.", "A gentle reflection prompt: what would you carry forward?", "Choose one small idea to save in your own words.", "Ready for the complete reading experience? Use the legal route below."
];

export async function POST(request: NextRequest) {
  const { bookId } = await request.json().catch(() => ({})) as {bookId?:string};
  const book = catalogue.find((item) => item.id === bookId);
  if (!book) return NextResponse.json({ error:"Book not found" }, { status:404 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ cards:fallback(book.title),source:"Booktender fallback" });
  const prompt = `Create exactly 10 original, spoiler-free Booktender Book Bite cards for ${book.title} by ${book.author}. Metadata: ${book.description}. Do not quote, reproduce, or paraphrase copyrighted summaries. Each card must be a concise original reading orientation or reflection under 38 words. Return only JSON: {"cards":["..."]}.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.55,maxOutputTokens:650,responseMimeType:"application/json"}}),signal:AbortSignal.timeout(12_000) });
    const data=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]}; const text=data.candidates?.[0]?.content?.parts?.[0]?.text;
    const cards=text ? (JSON.parse(text) as {cards?:string[]}).cards : undefined;
    if(cards?.length===10) return NextResponse.json({cards,source:"Gemini"});
  } catch { /* fallback */ }
  return NextResponse.json({cards:fallback(book.title),source:"Booktender fallback"});
}
