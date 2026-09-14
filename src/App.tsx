import { useState } from "react";
import { clearTrip, loadStoredTrip, saveTrip, unlinkLibrary } from "./lib/storage";
import { ImportPage } from "./pages/ImportPage";
import { TripPage } from "./pages/TripPage";
import type { TripDoc } from "./types";

export default function App() {
  const [doc, setDoc] = useState<TripDoc | null>(() => loadStoredTrip());

  function setActive(next: TripDoc) {
    saveTrip(next);
    setDoc(next);
  }

  function importFresh(next: TripDoc) {
    unlinkLibrary();
    setActive(next);
  }

  function reset() {
    clearTrip();
    setDoc(null);
  }

  if (!doc) return <ImportPage onImport={importFresh} onOpenSaved={setActive} />;
  return <TripPage doc={doc} onChange={setActive} onReset={reset} />;
}
