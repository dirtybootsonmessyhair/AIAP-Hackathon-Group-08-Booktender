import { NextRequest, NextResponse } from "next/server";
import { catalogue } from "../../../lib/catalogue";

type GutenbergBook = { id:number; title:string; authors:{name:string}[]; subjects:string[]; download_count:number; formats:Record<string,string> };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "fiction";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
  try {
    const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&page=${page}`, { next:{ revalidate:3600 }, headers:{"User-Agent":"Booktender/1.0 (+https://aiap-hackathon-group-08-booktender.vercel.app)"}, signal:AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Catalogue unavailable");
    const data = await response.json() as { results:GutenbergBook[]; next:string|null };
    return NextResponse.json({ source:"Project Gutenberg via Gutendex", hasMore:Boolean(data.next), books:data.results.map((book)=>({ id:`gutenberg-${book.id}`, gutenbergId:book.id, title:book.title, author:book.authors.map((author)=>author.name).join(", ") || "Unknown author", subjects:book.subjects.slice(0,3), popularity:book.download_count, cover:book.formats["image/jpeg"] || null, readerUrl:`https://www.gutenberg.org/ebooks/${book.id}` })) });
  } catch {
    const words=query.toLowerCase().split(/\s+/).filter(Boolean);
    const publicDomain=catalogue.filter((book)=>book.publicDomain);
    const matched=publicDomain.filter((book)=>words.some((word)=>`${book.title} ${book.author} ${book.genres.join(" ")}`.toLowerCase().includes(word)));
    const picks=(matched.length ? matched : publicDomain).slice(0,8).map((book)=>({ id:book.id, title:book.title, author:book.author, subjects:book.genres, popularity:book.communityCount, cover:book.cover || null, readerUrl:book.sourceUrl }));
    return NextResponse.json({ source:"Project Gutenberg official search with curated offline picks", hasMore:true, searchUrl:`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}`, books:picks });
  }
}
