import { isAxiosError } from "axios";
import { API } from "./http";

export type Room = {
  id: string;
  name: string;
  owner_id: number;
  created_at: string;
};

export type RoomDocument = {
  id: string;
  filename: string;
  owner_id: number;
  classification: string;
  file_size_bytes: number;
  shared_at?: string;
};

export type RoomDetails = Room & {
  documents: RoomDocument[];
};

type Envelope<T> = {
  data: T;
};

type ErrorBody = {
  errors?: {
    step_up_required?: boolean;
    challenge_id?: string;
    challenge_otp?: string;
  };
};

export function roomChallenge(
  error: unknown,
): { id: string; otp: string } | null {
  if (!isAxiosError<ErrorBody>(error)) return null;

  const details = error.response?.data?.errors;

  if (!details?.step_up_required || !details.challenge_id) {
    return null;
  }

  return {
    id: details.challenge_id,
    otp: details.challenge_otp ?? "",
  };
}

export const rooms = {
  async list(): Promise<Room[]> {
    const response = await API.get<Envelope<Room[]>>("/rooms");
    return response.data.data;
  },

  async create(name: string): Promise<Room> {
    const response = await API.post<Envelope<Room>>(
      "/rooms",
      { name },
    );

    return response.data.data;
  },

  async join(room_id: string): Promise<Room> {
    const response = await API.post<Envelope<Room>>(
      "/rooms/join",
      { room_id },
    );

    return response.data.data;
  },

  async get(id: string): Promise<RoomDetails> {
    const response = await API.get<Envelope<RoomDetails>>(
      `/rooms/${id}`,
    );

    return response.data.data;
  },

  async documents(): Promise<RoomDocument[]> {
    const response = await API.get<Envelope<RoomDocument[]>>(
      "/documents/",
    );

    return response.data.data;
  },

  async share(
    roomId: string,
    document_id: string,
  ): Promise<void> {
    await API.post(`/rooms/${roomId}/documents`, {
      document_id,
    });
  },

  async download(id: string, token?: string): Promise<Blob> {
    try {
      const response = await API.get<Blob>(
        `/documents/${id}/download`,
        {
          responseType: "blob",
          headers: token
            ? { "X-Step-Up-Token": token }
            : undefined,
        },
      );

      return response.data;
    } catch (error) {
      // Decode JSON errors returned by a blob request.
      if (
        isAxiosError(error) &&
        error.response?.data instanceof Blob
      ) {
        try {
          error.response.data = JSON.parse(
            await error.response.data.text(),
          );
        } catch {
          // Keep the original error if the response is not JSON.
        }
      }

      throw error;
    }
  },
};