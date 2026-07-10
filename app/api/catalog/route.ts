import { NextRequest, NextResponse } from "next/server";

type GutenbergBook = { id:number; title:string; authors:{name:string}[]; subjects:string[]; download_count:number; formats:Record<string,string> };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "fiction";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
  try {
    const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&page=${page}`, { next:{ revalidate:3600 }, headers:{"User-Agent":"Booktender/1.0 (+https://aiap-hackathon-group-08-booktender.vercel.app)"}, signal:AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Catalog unavailable");
    const data = await response.json() as { results:GutenbergBook[]; next:string|null };
    return NextResponse.json({ source:"Project Gutenberg via Gutendex", hasMore:Boolean(data.next), books:data.results.map((book)=>({ id:`gutenberg-${book.id}`, gutenbergId:book.id, title:book.title, author:book.authors.map((author)=>author.name).join(", ")||"Unknown author", subjects:book.subjects.slice(0,3), popularity:book.download_count, cover:book.formats["image/jpeg"]||null, readerUrl:`https://www.gutenberg.org/ebooks/${book.id}` })) });
  } catch {
    const searchUrl=`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}`;
    return NextResponse.json({ source:"Project Gutenberg official search", hasMore:true, books:[{ id:`gutenberg-search-${query.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`, title:`Search Project Gutenberg for “${query}”`, author:"Open the official catalogue for all matching free eBooks", subjects:["75,000+ free eBooks"], popularity:0, cover:null, readerUrl:searchUrl }] });
  }
}
