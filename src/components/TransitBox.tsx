import { canEmbedDirections, googleDirEmbedUrl, googleDirUrl, stopLabel } from "../lib/links";
import type { Transport } from "../types";

export function TransitStops({ transport }: { transport: Transport }) {
  const from = stopLabel(transport.fromStop, transport.fromPlaceQuery);
  const to = stopLabel(transport.toStop, transport.toPlaceQuery);
  if (!from || !to || from === to) return null;
  return (
    <p className="stops">
      起點 {from}
      <span aria-hidden> → </span>
      終點 {to}
    </p>
  );
}

export function TransitBox({ transport, title }: { transport: Transport; title: string }) {
  if (!canEmbedDirections(transport)) return null;
  return (
    <details className="tool-details transit-tool" onClick={(event) => event.stopPropagation()}>
      <summary>路線</summary>
      <a href={googleDirUrl(transport)} target="_blank" rel="noreferrer">
        在 Google 地圖中打開
      </a>
      <iframe title={`${title} 交通`} src={googleDirEmbedUrl(transport)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    </details>
  );
}
