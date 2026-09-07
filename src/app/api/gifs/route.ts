import { NextResponse } from 'next/server';

const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'h26saC4d4kLgI13g2pn4nQeTwZiN3JIn021kPLlLzNuVSTweDGyKXXn0jdCLNLDP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || 'trending';
  const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 50);

  try {
    let url = '';
    if (query === 'trending') {
      url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`;
    } else {
      url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
        query
      )}&limit=${limit}&rating=g`;
    }

    const res = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 mins
    });

    if (!res.ok) {
      // If Klipy or alternate format
      const klipyRes = await fetch(`https://api.klipy.co/v1/search?query=${encodeURIComponent(query)}&key=${GIPHY_API_KEY}&limit=${limit}`);
      if (klipyRes.ok) {
        const kData = await klipyRes.json();
        return NextResponse.json({ gifs: kData.data || [] });
      }
      return NextResponse.json({ gifs: [], error: 'Failed to fetch from GIF provider' }, { status: res.status });
    }

    const data = await res.json();
    const gifs = (data.data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      url: item.images?.downsized_medium?.url || item.images?.fixed_height?.url || item.images?.original?.url,
      preview: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url,
    })).filter((g: any) => !!g.url);

    return NextResponse.json({ gifs });
  } catch (error: any) {
    console.error('GIF API route error:', error);
    return NextResponse.json({ gifs: [], error: error.message }, { status: 500 });
  }
}
