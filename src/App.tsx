import { useState } from "react";
import { clearTrip, loadStoredTrip, saveTrip } from "./lib/storage";
import { ImportPage } from "./pages/ImportPage";
import { TripPage } from "./pages/TripPage";
import type { TripDoc } from "./types";

export default function App() {
  const [doc, setDoc] = useState<TripDoc | null>(() => loadStoredTrip());

  function importDoc(next: TripDoc) {
    saveTrip(next);
    setDoc(next);
  }

  function reset() {
    clearTrip();
    setDoc(null);
  }

  if (!doc) return <ImportPage onImport={importDoc} />;
  return <TripPage doc={doc} onChange={importDoc} onReset={reset} />;
}
