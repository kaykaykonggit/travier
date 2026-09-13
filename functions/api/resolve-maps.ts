function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "))
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*[·|].*$/, "")
      .replace(/\s*-\s*Google Maps.*$/i, "")
      .trim();
  } catch {
    return raw;
  }
}

function fromUrl(finalUrl: string): { name: string; lat?: number; lng?: number } {
  const at = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const lat = at ? Number(at[1]) : undefined;
  const lng = at ? Number(at[2]) : undefined;
  try {
    const parsed = new URL(finalUrl);
    const dest = parsed.searchParams.get("destination") || parsed.searchParams.get("q") || parsed.searchParams.get("query");
    const path = parsed.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/);
    const name = decodeName(dest || path?.[1] || "");
    return { name, lat, lng };
  } catch {
    return { name: "", lat, lng };
  }
}

function fromHtml(html: string): { title: string; image: string } {
  const title =
    html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1] ||
    "";
  const image =
    html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1] ||
    "";
  return {
    title: decodeName(title.replace(/\s*-\s*Google Maps.*$/i, "")),
    image,
  };
}

export const onRequestGet = async (context: { request: Request }) => {
  const target = new URL(context.request.url).searchParams.get("url") || "";
  if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(target)) {
    return Response.json({ error: "unsupported" }, { status: 400 });
  }

  const res = await fetch(target, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Travier/1.0)",
      Accept: "text/html",
    },
  });
  const finalUrl = res.url || target;
  const html = await res.text();
  const parsed = fromUrl(finalUrl);
  const meta = fromHtml(html);
  const name = parsed.name || meta.title;
  if (!name) {
    return Response.json({ error: "no name", finalUrl }, { status: 422 });
  }

  return Response.json({
    name,
    placeQuery: name,
    source: finalUrl,
    lat: parsed.lat,
    lng: parsed.lng,
    imageUrl: meta.image || null,
  });
};
