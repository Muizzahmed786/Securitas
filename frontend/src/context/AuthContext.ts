import { createContext, useContext } from "react";
import type { User, Permission, UploadReceipt } from "../api/client";
export type AuthState = {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  permissionsLoading: boolean;
  permissionError: string;
  receipts: UploadReceipt[];
  setUser: (user: User | null) => void;
  reloadPermissions: () => Promise<void>;
  addReceipt: (receipt: UploadReceipt) => void;
  can: (permission: string) => boolean;
};
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
