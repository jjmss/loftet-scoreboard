import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Snapshot, Tab, User } from "./types";
import { nextRotation, Wheel } from "./Wheel";

function formatWhen(ts: number) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function rankClass(index: number) {
  if (index === 0) return "rank gold";
  if (index === 1) return "rank silver";
  if (index === 2) return "rank bronze";
  return "rank";
}

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("oppgaver");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [present, setPresent] = useState<string[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const tickets = useMemo(
    () => state?.leaderboard.find((row) => row.id === me?.id)?.tickets ?? 0,
    [state, me],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await api<User>("/api/me");
        const snapshot = await api<Snapshot>("/api/state");
        if (!cancelled) {
          setMe(user);
          setState(snapshot);
        }
      } catch {
        try {
          const snapshot = await api<Snapshot>("/api/state");
          if (!cancelled) setState(snapshot);
        } catch {
          /* tom tavle til vi får kontakt */
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    let ws: WebSocket | null = null;
    let timer = 0;
    let delay = 600;

    const connect = () => {
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => {
        delay = 600;
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as { type: string; payload: Snapshot };
        if (msg.type === "state") setState(msg.payload);
      };
      ws.onclose = () => {
        timer = window.setTimeout(connect, delay);
        delay = Math.min(delay * 1.6, 8000);
      };
    };
    connect();
    return () => {
      window.clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [me]);

  function showToast(text: string) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy("register");
    try {
      const user = await api<User>("/api/register", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const snapshot = await api<Snapshot>("/api/state");
      setMe(user);
      setState(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke registrere");
    } finally {
      setBusy(null);
    }
  }

  async function complete(choreId: string) {
    setBusy(choreId);
    try {
      const res = await api<{ state: Snapshot }>("/api/chores/" + choreId + "/complete", {
        method: "POST",
      });
      setState(res.state);
      showToast("+1 lodd!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setMe(null);
    setName("");
    setPresent([]);
    setWinnerName(null);
  }

  function togglePresent(id: string) {
    setPresent((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function spin() {
    if (!state || present.length === 0 || spinning) return;
    setBusy("spin");
    setWinnerName(null);
    try {
      const res = await api<{ spin: { winnerId: string; winnerName: string }; state: Snapshot }>(
        "/api/friday/spin",
        { method: "POST", body: JSON.stringify({ attendeeIds: present }) },
      );
      const names = res.state.latestSpin?.attendeeNames ?? [];
      const index = Math.max(
        0,
        names.findIndex((_, i) => res.state.latestSpin?.attendeeIds[i] === res.spin.winnerId),
      );
      setState(res.state);
      setSpinning(true);
      const target = nextRotation(rotation, index, Math.max(names.length, 1));
      requestAnimationFrame(() => setRotation(target));
      window.setTimeout(() => {
        setSpinning(false);
        setWinnerName(res.spin.winnerName);
        setBusy(null);
      }, 4300);
    } catch (err) {
      setBusy(null);
      showToast(err instanceof Error ? err.message : "Kunne ikke spinne");
    }
  }

  if (!ready) {
    return (
      <div className="register">
        <p>Åpner loftet…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <form className="register" onSubmit={register}>
        <svg className="bowl" viewBox="0 0 160 120" aria-hidden="true">
          <ellipse cx="80" cy="86" rx="54" ry="18" fill="#4a1d2b" />
          <path d="M28 78c8 24 104 24 112 0" fill="#6b2a3c" />
          <circle cx="58" cy="58" r="18" fill="#e4572e" />
          <circle cx="86" cy="50" r="16" fill="#f2a93b" />
          <circle cx="108" cy="62" r="15" fill="#3f7d45" />
          <circle cx="74" cy="68" r="13" fill="#b4233a" />
        </svg>
        <h1>Loftet</h1>
        <p>Poengtavle og lodd for fellesoppgaver hos Fruktsalat. Skriv navnet ditt så husker vi deg neste gang.</p>
        {error ? <p className="error">{error}</p> : null}
        <label htmlFor="name">Hva heter du?</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="F.eks. Ada"
          maxLength={32}
          required
        />
        <button className="primary block" type="submit" disabled={busy === "register"}>
          {busy === "register" ? "Registrerer…" : "Bli med"}
        </button>
      </form>
    );
  }

  const attendees = state?.leaderboard.filter((row) => present.includes(row.id)) ?? [];

  return (
    <div className="shell">
      {toast ? <div className="toast">{toast}</div> : null}
      <header className="topbar">
        <h1 className="brand">
          Loftet
          <span>Fruktsalat · fellesoppgaver</span>
        </h1>
        <div className="ticket" aria-label={`${tickets} lodd`}>
          <small>Lodd</small>
          <strong>{tickets}</strong>
        </div>
      </header>
      <p className="hello">
        Hei, <b>{me.name}</b> — hver oppgave gir ett lodd.
      </p>

      {tab === "oppgaver" && (
        <section className="stack" aria-label="Oppgaver">
          {(state?.chores ?? []).map((chore) => (
            <article className="chore" key={chore.id}>
              <div className="emoji" aria-hidden="true">
                {chore.emoji}
              </div>
              <div>
                <h2>{chore.name}</h2>
                <p className="muted">+1 lodd</p>
              </div>
              <button
                className="primary"
                disabled={busy === chore.id}
                onClick={() => complete(chore.id)}
              >
                {busy === chore.id ? "…" : "Loggfør"}
              </button>
            </article>
          ))}
          <div className="card">
            <h2>Siste aktivitet</h2>
            {state?.activity.length ? (
              <ul className="activity" style={{ marginTop: 12 }}>
                {state.activity.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <span className="emoji" style={{ width: 40, height: 40, fontSize: "1.1rem" }}>
                      {item.choreEmoji}
                    </span>
                    <div>
                      <strong>{item.userName}</strong> {item.choreName.toLowerCase()}
                      <p className="muted">{formatWhen(item.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">Ingen lodd ennå — loggfør en oppgave!</p>
            )}
          </div>
        </section>
      )}

      {tab === "tavle" && (
        <section className="stack" aria-label="Poengtavle">
          {(state?.leaderboard ?? []).map((row, index) => (
            <article className={`board-row${row.id === me.id ? " me" : ""}`} key={row.id}>
              <div className={rankClass(index)}>{index + 1}</div>
              <div>
                <p className="name">
                  {row.name}
                  {row.id === me.id ? " · deg" : ""}
                </p>
                <p className="muted">{row.tickets === 1 ? "1 lodd" : `${row.tickets} lodd`}</p>
              </div>
              <div className="lodd">{row.tickets}</div>
            </article>
          ))}
          {!state?.leaderboard.length ? <p className="empty">Ingen er registrert ennå.</p> : null}
        </section>
      )}

      {tab === "fredag" && (
        <section aria-label="Fredagshjulet">
          <div className="card" style={{ marginBottom: 12 }}>
            <h2>Fredagshjulet</h2>
            <p className="muted">Merk hvem som er på møtet. Hjulet trekker bare blant de som er til stede.</p>
          </div>
          {winnerName ? (
            <div className="winner-banner">
              <p className="muted" style={{ color: "#f3ead8" }}>
                Vinneren er
              </p>
              <h2>{winnerName}</h2>
            </div>
          ) : null}
          <Wheel names={attendees.map((row) => row.name)} rotation={rotation} spinning={spinning} />
          <div className="row-actions">
            <button
              type="button"
              className="chip"
              onClick={() => setPresent((state?.leaderboard ?? []).map((row) => row.id))}
            >
              Merk alle
            </button>
            <button type="button" className="chip" onClick={() => setPresent([])}>
              Fjern alle
            </button>
          </div>
          <div className="stack">
            {(state?.leaderboard ?? []).map((row) => {
              const selected = present.includes(row.id);
              return (
                <button
                  type="button"
                  key={row.id}
                  className={`person${selected ? " selected" : ""}`}
                  onClick={() => togglePresent(row.id)}
                  aria-pressed={selected}
                >
                  <span className="check">{selected ? "✓" : ""}</span>
                  <span className="name">{row.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ height: 12 }} />
          <button
            className="primary block"
            disabled={present.length === 0 || spinning || busy === "spin"}
            onClick={spin}
          >
            {spinning || busy === "spin" ? "Spinner…" : "Spinn hjulet"}
          </button>
          {state?.latestSpin ? (
            <p className="muted" style={{ textAlign: "center", marginTop: 14 }}>
              Sist vant <b>{state.latestSpin.winnerName}</b>
              <br />
              {formatWhen(state.latestSpin.spunAt)} · {state.latestSpin.attendeeNames.length} til stede
            </p>
          ) : null}
        </section>
      )}

      <button className="ghost" type="button" onClick={logout} style={{ marginTop: 18 }}>
        Bytt bruker
      </button>

      <nav className="tabs">
        <button className={`tab${tab === "oppgaver" ? " active" : ""}`} onClick={() => setTab("oppgaver")}>
          Oppgaver
        </button>
        <button className={`tab${tab === "tavle" ? " active" : ""}`} onClick={() => setTab("tavle")}>
          Tavle
        </button>
        <button className={`tab${tab === "fredag" ? " active" : ""}`} onClick={() => setTab("fredag")}>
          Fredag
        </button>
      </nav>
    </div>
  );
}
