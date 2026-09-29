import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { useAuth } from "../lib/auth";
import { fetchRoutine, startSession } from "../lib/data";
import type { Routine } from "../lib/types";
import RoutineView from "../components/RoutineView";
import { Button, ErrorNote, Spinner } from "../components/ui";

export default function RoutinePage() {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (id) fetchRoutine(id).then(setRoutine); }, [id]);

  if (routine === undefined) return <Spinner />;
  if (routine === null) return <p className="text-slate-400">Rutina no encontrada.</p>;

  async function start() {
    setBusy(true);
    try {
      const s = await startSession(session!.user.id, routine!.id);
      navigate(`/entreno/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>
      <RoutineView routine={routine} />
      <ErrorNote message={error} />
      <Button className="w-full py-3" onClick={start} loading={busy}><Play className="h-4 w-4" /> Empezar entrenamiento</Button>
    </div>
  );
}
