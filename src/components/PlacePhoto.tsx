import { useEffect, useState } from "react";
import type { LatLng } from "../lib/geocode";
import { isUsableImageUrl, lookupPlacePhotos, skipPhotoLookup } from "../lib/placePhoto";

export function PlacePhoto({
  imageUrl,
  query,
  title,
  kind,
  point,
  alt,
}: {
  imageUrl?: string | null;
  query: string;
  title?: string;
  kind?: string | null;
  point?: LatLng;
  alt: string;
}) {
  const [urls, setUrls] = useState<string[]>(() => (isUsableImageUrl(imageUrl) ? [imageUrl!.trim()] : []));
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (skipPhotoLookup(kind) && !isUsableImageUrl(imageUrl)) {
      setUrls([]);
      setIndex(0);
      return;
    }
    setUrls(isUsableImageUrl(imageUrl) ? [imageUrl!.trim()] : []);
    setIndex(0);
    lookupPlacePhotos({ imageUrl, query, title, kind, point }).then((found) => {
      if (!cancelled) {
        setUrls(found);
        setIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, query, title, kind, point?.lat, point?.lng]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const src = urls[index] ?? null;
  if (!src) return null;

  return (
    <>
      <figure className="spot-photo">
        <button type="button" className="spot-photo-btn" onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setIndex((current) => current + 1)}
          />
        </button>
      </figure>
      {open && (
        <div
          className="spot-zoom"
          role="dialog"
          aria-label={alt}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <img src={src} alt={alt} referrerPolicy="no-referrer" />
        </div>
      )}
    </>
  );
}
