import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  DoorOpen,
  Shield,
  Presentation,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { errorMessage } from "../api/http";
import { rooms, type Room } from "../api/rooms";

export default function Rooms() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    rooms.list()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(
    event: FormEvent,
    mode: "create" | "join",
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const room =
        mode === "create"
          ? await rooms.create(name.trim())
          : await rooms.join(roomId.trim());

      navigate(`/workspace/rooms/${room.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-mono font-medium text-amber-400 uppercase">
            Collaborative Enclave
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Document Rooms
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Zero-trust multi-party enclaves. Initialize a secure room or enter an active enclave identifier to collaborate.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Cards: Create & Join */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Room Card */}
        <form
          onSubmit={(event) => void submit(event, "create")}
          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121218] p-6 sm:p-7 shadow-xl"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Plus size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Create Room</h2>
                <p className="text-xs text-neutral-400">
                  Initialize an isolated enclave. You become the room host.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="create-room-name"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Room Name
                </label>
                <input
                  id="create-room-name"
                  className="input-style mt-1.5"
                  placeholder="e.g. Q4 Financial Audit"
                  value={name}
                  maxLength={80}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  Descriptive title for your team or audit enclave (max 80 chars).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={busy || !name.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Creating Room...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Room</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Join Room Card */}
        <form
          onSubmit={(event) => void submit(event, "join")}
          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121218] p-6 sm:p-7 shadow-xl"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-neutral-300">
                <DoorOpen size={20} className="text-amber-400/90" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Join Room</h2>
                <p className="text-xs text-neutral-400">
                  Enter an existing enclave identifier to access shared assets.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="join-room-id"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Room ID
                </label>
                <input
                  id="join-room-id"
                  className="input-style font-mono mt-1.5"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={roomId}
                  maxLength={36}
                  required
                  onChange={(event) => setRoomId(event.target.value)}
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  UUID provided by the room creator or administrator.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              type="submit"
              className="btn-secondary w-full justify-center border-amber-500/30 text-amber-300 hover:border-amber-500 hover:text-white"
              disabled={busy || !roomId.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <>
                  <DoorOpen className="h-4 w-4" />
                  <span>Join Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Guarantee Banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
        <span className="font-semibold text-amber-400">Security Guarantee: </span>
        <span className="text-neutral-300">
          Room boundaries are cryptographically isolated. Document decryption requires verified room membership, adaptive risk scoring, and mandatory cryptographic audit logging.
        </span>
      </div>

      {/* Rooms List Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-black/40 p-2 text-amber-400">
              <Presentation size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Your Rooms</h2>
              <p className="text-xs text-neutral-400">
                Active enclaves you own or have joined as an authorized participant.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-mono text-neutral-400">
            {items.length} {items.length === 1 ? "room" : "rooms"}
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#121218] p-12 text-xs text-neutral-400 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
            <span>Loading active enclaves...</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#121218]/40 p-12 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-neutral-400">
              <Presentation className="h-6 w-6 text-amber-400/80" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-white">No active rooms yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-400">
              Create a new room above to start collaborating, or enter a room ID to join an existing enclave.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((room) => (
              <Link
                key={room.id}
                to={`/workspace/rooms/${room.id}`}
                className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#121218] p-5 transition-all hover:border-amber-500/40 hover:bg-[#161620] hover:shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 group-hover:border-amber-500/40">
                        <Shield size={18} />
                      </div>
                      <h3 className="truncate text-sm font-medium text-white transition-colors group-hover:text-amber-300">
                        {room.name}
                      </h3>
                    </div>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-neutral-500 transition-all group-hover:translate-x-0.5 group-hover:text-amber-400"
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">ID</span>
                    <span className="truncate rounded border border-white/5 bg-black/40 px-2 py-0.5 font-mono text-xs text-neutral-400">
                      {room.id}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active Enclave
                  </span>
                  <span className="font-mono text-neutral-400 group-hover:text-neutral-200">
                    Enter &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
