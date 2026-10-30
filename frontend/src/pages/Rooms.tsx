import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";

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

  const input =
    "mt-2 w-full rounded border border-gray-300 bg-white p-2";

  const button =
    "rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50";

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">
        Document rooms
      </h1>

      <p>Create a room or enter a room ID to join.</p>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          onSubmit={(event) => void submit(event, "create")}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
        >
          <h2 className="font-semibold">Create room</h2>

          <label className="block">
            Room name
            <input
              className={input}
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <button
            className={button}
            disabled={busy || !name.trim()}
          >
            Create room
          </button>
        </form>

        <form
          onSubmit={(event) => void submit(event, "join")}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
        >
          <h2 className="font-semibold">Join room</h2>

          <label className="block">
            Room ID
            <input
              className={input}
              value={roomId}
              maxLength={36}
              required
              onChange={(event) => setRoomId(event.target.value)}
            />
          </label>

          <button
            className={button}
            disabled={busy || !roomId.trim()}
          >
            Join room
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your rooms</h2>

        {loading ? (
          <p>Loading rooms...</p>
        ) : (
          items.length === 0 && <p>No rooms yet.</p>
        )}

        {items.map((room) => (
          <Link
            key={room.id}
            to={`/workspace/rooms/${room.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
          >
            <p className="font-medium">{room.name}</p>
            <p className="break-all text-sm text-gray-600">
              {room.id}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}