import { useEffect, useId, useRef, useState } from "react";
import { pointsFromCache, rememberPoint, searchPlaceSuggestions, type LatLng, type PlaceSuggestion } from "../lib/geocode";
import { googleSearchUrl, looksLikeMapsLink } from "../lib/links";
import { resolvePlaceInput } from "../lib/resolvePlace";

export function PlaceSuggest({
  value,
  onPlace,
  onPick,
  placeholder,
  biasQuery,
}: {
  value: string;
  onPlace: (place: string) => void;
  onPick?: (place: string, name: string) => void;
  placeholder?: string;
  biasQuery?: string;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2 || looksLikeMapsLink(q) || /^https?:/i.test(q)) {
      setHits([]);
      return;
    }
    const bias: LatLng | null = biasQuery ? pointsFromCache([biasQuery]).get(biasQuery.trim()) ?? null : null;
    const handle = window.setTimeout(() => {
      void searchPlaceSuggestions(q, bias).then((next) => {
        setHits(next);
        setActive(0);
      });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [draft, biasQuery]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function apply(place: string, name: string, picked: boolean) {
    if (picked) onPick?.(place, name);
    else onPlace(place);
  }

  function pick(hit: PlaceSuggestion) {
    rememberPoint(hit.place, { lat: hit.lat, lng: hit.lng, label: hit.name });
    apply(hit.place, hit.name, true);
    setDraft(hit.place);
    setHits([]);
    setOpen(false);
  }

  async function fromMapsUrl(raw: string) {
    const text = raw.trim();
    if (!looksLikeMapsLink(text) && !/^https?:/i.test(text)) return false;
    setBusy(true);
    const resolved = await resolvePlaceInput(text, biasQuery ?? "");
    setBusy(false);
    if (!resolved) return false;
    if (resolved.lat != null && resolved.lng != null) {
      rememberPoint(resolved.placeQuery, { lat: resolved.lat, lng: resolved.lng, label: resolved.name });
    }
    onPick?.(resolved.placeQuery, resolved.name);
    if (!onPick) onPlace(resolved.placeQuery);
    setDraft(resolved.placeQuery);
    setHits([]);
    setOpen(false);
    return true;
  }

  const shown = open && hits.length > 0;

  return (
    <div className="place-suggest" ref={wrapRef}>
      <div className="place-suggest-row">
        <input
          value={draft}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown ? `${listId}-${active}` : undefined}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            onPlace(event.target.value);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!looksLikeMapsLink(text) && !/^https?:/i.test(text.trim())) return;
            event.preventDefault();
            void fromMapsUrl(text);
          }}
          onBlur={() => {
            if (looksLikeMapsLink(draft) || /^https?:/i.test(draft.trim())) void fromMapsUrl(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!shown) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % hits.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index - 1 + hits.length) % hits.length);
            }
            if (event.key === "Enter" && hits[active]) {
              event.preventDefault();
              pick(hits[active]);
            }
          }}
        />
        {draft.trim() ? (
          <a className="place-map-link" href={googleSearchUrl(draft)} target="_blank" rel="noreferrer">
            地圖
          </a>
        ) : null}
      </div>
      {busy ? <p className="place-suggest-status">正在讀取地圖連結…</p> : null}
      {shown ? (
        <ul className="place-suggest-list" id={listId} role="listbox">
          {hits.map((hit, index) => (
            <li key={hit.key} role="presentation">
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(hit)}
              >
                <strong>{hit.name}</strong>
                {hit.detail ? <small>{hit.detail}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
