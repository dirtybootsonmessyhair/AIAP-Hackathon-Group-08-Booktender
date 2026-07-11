import { NextRequest, NextResponse } from "next/server";
import { catalogue, type CatalogueBook } from "../../../lib/catalogue";

const fallback = (book: Pick<CatalogueBook,"title"|"author"|"description">) => [
  `${book.title} by ${book.author}: ${book.description}`,
  "Start with the invitation: let this book set the pace before you decide what it means to you.",
  "Notice one central question, character, or idea that keeps returning.",
  "Read for the emotional atmosphere as much as the plot or argument.",
  "Pause to ask what the author may be asking you to pay attention to.",
  "Find one detail that makes the book feel specific and alive.",
  "Consider where the book challenges an easy assumption.",
  "Write one reflection in your own words before moving on.",
  "Save the idea you would genuinely want to remember next week.",
  "Ready for the complete reading experience? Use the legal route below."
];

export async function POST(request: NextRequest) {
  const { bookId, book: suppliedBook } = await request.json().catch(() => ({})) as {bookId?:string;book?:Partial<CatalogueBook>};
  const seed = catalogue.find((item) => item.id === bookId);
  const book = seed || (suppliedBook?.title && suppliedBook.author && suppliedBook.description
    ? { id: bookId || "external", title: suppliedBook.title, author: suppliedBook.author, description: suppliedBook.description }
    : undefined);
  if (!book) return NextResponse.json({ error:"Book not found" }, { status:404 });
  const originalCards = seed?.bites;
  if (originalCards?.length === 10) return NextResponse.json({cards:originalCards,source:"Booktender editorial"});
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ cards:fallback(book),source:"Booktender editorial fallback" });
  const prompt = `Create exactly 10 original, spoiler-free Booktender Book Bite cards for ${book.title} by ${book.author}. Metadata: ${book.description}. Do not quote, reproduce, or paraphrase copyrighted summaries. Each card must be a concise original reading orientation or reflection under 38 words. Return only JSON: {"cards":["..."]}.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.55,maxOutputTokens:650,responseMimeType:"application/json"}}),signal:AbortSignal.timeout(12_000) });
    const data=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]}; const text=data.candidates?.[0]?.content?.parts?.[0]?.text;
    const cards=text ? (JSON.parse(text) as {cards?:string[]}).cards : undefined;
    if(cards?.length===10) return NextResponse.json({cards,source:"Gemini"});
  } catch { /* fallback */ }
  return NextResponse.json({cards:fallback(book),source:"Booktender editorial fallback"});
}
