import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Play, Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import { callFunction, supabase } from "../lib/supabase";
import { fetchRoutine, startSession } from "../lib/data";
import type { CoachMessage, Routine } from "../lib/types";
import RoutineView from "../components/RoutineView";
import { Button, ErrorNote, Spinner } from "../components/ui";

const SUGGESTIONS = ["¿Qué entreno hoy?", "Solo tengo 30 minutos", "Quiero enfocarme en espalda", "¿Cómo respiro al hacer sentadillas?"];

export default function Coach() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<CoachMessage[] | null>(null);
  const [routines, setRoutines] = useState<Record<string, Routine>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  async function loadRoutines(ids: string[]) {
    const missing = ids.filter((id) => !routines[id]);
    const loaded = await Promise.all(missing.map(fetchRoutine));
    setRoutines((prev) => {
      const next = { ...prev };
      loaded.forEach((r) => { if (r) next[r.id] = r; });
      return next;
    });
  }

  useEffect(() => {
    supabase.from("coach_messages").select("*").order("created_at", { ascending: false }).limit(30).then(async ({ data }) => {
      const msgs = ((data ?? []) as CoachMessage[]).reverse();
      setMessages(msgs);
      await loadRoutines(msgs.filter((m) => m.routine_id).map((m) => m.routine_id!));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, routines, sending]);

  async function send(content: string) {
    const msg = content.trim();
    if (!msg || sending) return;
    setError(null);
    setSending(true);
    setText("");
    const optimistic: CoachMessage = { id: crypto.randomUUID(), role: "user", content: msg, routine_id: null, created_at: new Date().toISOString() };
    setMessages((m) => [...(m ?? []), optimistic]);
    try {
      const res = await callFunction<{ message: string; routine_id: string | null }>("coach", { message: msg });
      if (res.routine_id) await loadRoutines([res.routine_id]);
      setMessages((m) => [...(m ?? []), {
        id: crypto.randomUUID(), role: "assistant", content: res.message, routine_id: res.routine_id ?? null, created_at: new Date().toISOString(),
      }]);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      setText(msg);
    } finally {
      setSending(false);
    }
  }

  // Envío automático desde los atajos de la pantalla Hoy (?q=...)
  useEffect(() => {
    const q = params.get("q");
    if (q && messages && !autoSent.current) {
      autoSent.current = true;
      setParams({}, { replace: true });
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function start(routineId: string) {
    setStarting(routineId);
    try {
      const s = await startSession(session!.user.id, routineId);
      navigate(`/entreno/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  if (!messages) return <Spinner />;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15"><Bot className="h-5 w-5 text-brand" /></div>
        <div>
          <h1 className="text-xl font-bold">Coach</h1>
          <p className="text-xs text-slate-400">Pídele una rutina o pregúntale sobre técnica</p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
            <p className="font-semibold">¡Hola! Soy tu coach 💪</p>
            <p className="mt-1 text-sm text-slate-400">Cuéntame cuánto tiempo tienes, cómo te sientes o qué quieres trabajar y te armo una rutina de 4-5 ejercicios.</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm sm:max-w-[85%] ${
              m.role === "user" ? "rounded-br-sm bg-brand text-slate-950" : "rounded-bl-sm border border-slate-800 bg-slate-900"
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.routine_id && routines[m.routine_id] && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <RoutineView routine={routines[m.routine_id]} compact />
                  <Button className="mt-3 w-full" onClick={() => start(m.routine_id!)} loading={starting === m.routine_id}>
                    <Play className="h-4 w-4" /> Empezar entrenamiento
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:240ms]" />
              </span>
              <span className="ml-2">Armando tu rutina...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-24 mt-4 space-y-2 bg-slate-950 pt-2 md:bottom-4">
        <ErrorNote message={error} />
        {messages.length === 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500">{s}</button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej: hoy quiero pecho y tengo 40 minutos"
            maxLength={1500}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-brand"
          />
          <Button type="submit" disabled={!text.trim()} loading={sending} className="px-4" aria-label="Enviar">
            {!sending && <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
