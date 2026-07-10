import { NextRequest, NextResponse } from "next/server";

const usage = new Map<string,{count:number;reset:number}>();
const fallback = (message:string) => `Try this: name your mood, available time, and whether you want fiction or non-fiction. For “${message.slice(0,80)}”, I would start with a short public-domain classic from the catalogue, save it to your queue, and read one small Book Bite today.`;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const now = Date.now(); const entry = usage.get(ip) || {count:0,reset:now+60_000};
  if(now>entry.reset){entry.count=0;entry.reset=now+60_000;}
  if(entry.count>=8)return NextResponse.json({reply:"I’m taking a short breather. Please try again in a minute.",source:"rate limit"},{status:429});
  entry.count+=1;usage.set(ip,entry);
  const body = await request.json().catch(()=>({})) as {message?:string;mood?:string}; const message=body.message?.trim().slice(0,700)||"help me choose a book";
  if(!process.env.GEMINI_API_KEY)return NextResponse.json({reply:fallback(message),source:"Booktender fallback"});
  try {
    const prompt=`You are Booktender, a warm, concise reading companion. Give one practical, spoiler-free answer in under 110 words. Never invent a book title, quote, author, or fact. Suggest searching the public-domain catalogue when appropriate. User mood: ${body.mood||"unspecified"}. User: ${message}`;
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:180,temperature:0.7}}),signal:AbortSignal.timeout(10_000)});
    const data=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};const reply=data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return NextResponse.json({reply:reply||fallback(message),source:reply?"Gemini":"Booktender fallback"});
  } catch{return NextResponse.json({reply:fallback(message),source:"Booktender fallback"});}
}
