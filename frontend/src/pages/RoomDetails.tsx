import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage } from "../api/http";
import { risk } from "../api/risk";
import {
  rooms,
  roomChallenge,
  type RoomDetails as RoomData,
  type RoomDocument,
} from "../api/rooms";
import { useAuth } from "../context/AuthContext";

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RoomDetails() {
  const { roomId = "" } = useParams();
  const { user, can } = useAuth();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [owned, setOwned] = useState<RoomDocument[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [pending, setPending] = useState<{
    doc: RoomDocument;
    challengeId: string;
  } | null>(null);

  const [otp, setOtp] = useState("");

  useEffect(() => {
    let active = true;

    setRoom(null);
    setOwned([]);
    setSelected("");
    setPending(null);
    setError("");
    setNotice("");
    setLoading(true);

    Promise.all([
      rooms.get(roomId),
      rooms.documents(),
    ])
      .then(([details, documents]) => {
        if (!active) return;

        setRoom(details);

        setOwned(
          documents.filter(
            (doc) => String(doc.owner_id) === String(user?.id),
          ),
        );
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
  }, [roomId, user?.id]);

  async function share(event: FormEvent) {
    event.preventDefault();

    if (!selected || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await rooms.share(roomId, selected);

      setSelected("");
      setNotice("Document shared.");
      setRoom(await rooms.get(roomId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function download(
    doc: RoomDocument,
    token?: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const blob = await rooms.download(doc.id, token);

      saveFile(blob, doc.filename);

      setPending(null);
      setOtp("");
    } catch (err) {
      const challenge = roomChallenge(err);

      if (challenge) {
        setPending({
          doc,
          challengeId: challenge.id,
        });

        setOtp(challenge.otp);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();

    if (!pending || busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await risk.verifyStepUp(
        pending.challengeId,
        otp.trim(),
      );

      if (!result.step_up_token) {
        throw new Error("Verification did not return a token.");
      }

      await download(pending.doc, result.step_up_token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded border border-gray-300 bg-white px-3 py-2 disabled:opacity-50";

  const available = owned.filter(
    (doc) =>
      !room?.documents.some(
        (shared) => shared.id === doc.id,
      ),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <Link to="/workspace/rooms" className="underline">
        Back to rooms
      </Link>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="text-green-700">
          {notice}
        </p>
      )}

      {loading && <p>Loading room...</p>}

      {room && (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {room.name}
            </h1>

            <p className="break-all">
              Room ID:{" "}
              <code className="select-all">{room.id}</code>
            </p>

            <p className="text-sm text-gray-600">
              Share this ID with people you want to join.
            </p>
          </header>

          {can("documents.share") && (
            <form
              onSubmit={(event) => void share(event)}
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
            >
              <label className="block">
                Share one of your documents
                <select
                  value={selected}
                  onChange={(event) =>
                    setSelected(event.target.value)
                  }
                  required
                  className="mt-2 w-full rounded border border-gray-300 bg-white p-2"
                >
                  <option value="">Select a document</option>

                  {available.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename}
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-sm text-gray-600">
                Upload new documents using your existing Upload
                page, then return here.
              </p>

              <button
                className={button}
                disabled={busy || !selected}
              >
                Share in room
              </button>
            </form>
          )}

          {pending && (
            <form
              onSubmit={(event) => void verify(event)}
              className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
            >
              <h2 className="font-semibold">
                Additional verification required
              </h2>

              <label className="block">
                Verification code
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="mt-2 block rounded border border-gray-300 bg-white p-2"
                />
              </label>

              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={busy || !otp.trim()}
                >
                  Verify and download
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setOtp("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Shared documents
            </h2>

            <button
              className={button}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");

                try {
                  setRoom(await rooms.get(roomId));
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh documents
            </button>

            {room.documents.length === 0 && (
              <p>No documents available in this room.</p>
            )}

            {room.documents.map((doc) => (
              <article
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div>
                  <p className="break-all font-medium">
                    {doc.filename}
                  </p>

                  <p className="text-sm text-gray-600">
                    {doc.classification}
                  </p>
                </div>

                {can("documents.download") && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void download(doc)}
                  >
                    Download
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}