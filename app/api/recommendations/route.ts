import { NextRequest, NextResponse } from "next/server";
import { catalogue, fallbackRecommendations } from "../../../lib/catalogue";

type RequestBody = { mood?: string; genres?: string[]; prompt?: string; readIds?: string[] };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as RequestBody;
  const mood = body.mood || "Hopeful";
  const fallback = fallbackRecommendations(mood, body.genres).map((item) => ({ ...item, book: catalogue.find((book) => book.id === item.bookId) }));
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ recommendations: fallback, source: "Booktender fallback" });
  const shortlist = catalogue.map(({ id, title, author, genres, moods, readingMinutes }) => ({ id, title, author, genres, moods, readingMinutes }));
  const prompt = `You are Booktender. Select exactly 3 different books ONLY from this JSON catalogue: ${JSON.stringify(shortlist)}. User mood: ${mood}. Favourite genres: ${(body.genres || []).join(", ") || "none"}. Already read ids: ${(body.readIds || []).join(", ") || "none"}. Request: ${body.prompt || "a thoughtful next read"}. Return only valid JSON: {"recommendations":[{"bookId":"catalogue id","reason":"one warm spoiler-free sentence under 24 words"}]}. Never invent titles or ids.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.35,maxOutputTokens:400,responseMimeType:"application/json"} }), signal:AbortSignal.timeout(12_000) });
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = text ? JSON.parse(text) as { recommendations?: { bookId:string;reason:string }[] } : null;
    const valid = parsed?.recommendations?.filter((item) => catalogue.some((book) => book.id === item.bookId)).slice(0,3);
    if (valid?.length === 3) return NextResponse.json({ recommendations:valid.map((item)=>({...item,book:catalogue.find((book)=>book.id===item.bookId)})),source:"Gemini" });
  } catch { /* reliable local fallback below */ }
  return NextResponse.json({ recommendations:fallback, source:"Booktender fallback" });
}
