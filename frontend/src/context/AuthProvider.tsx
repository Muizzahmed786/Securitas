import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import { auth, errorMessage } from "../api/client";
import type { User, Permission, UploadReceipt } from "../api/client";
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setIdentity] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [receipts, setReceipts] = useState<UploadReceipt[]>([]);
  const setUser = useCallback((next: User | null) => {
    setIdentity(next);
    setPermissionsLoading(!!next);
    setPermissions([]);
    setPermissionError("");
    setReceipts([]);
  }, []);
  const reloadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      setPermissions(await auth.permissions());
      setPermissionError("");
    } catch (error) {
      setPermissions([]);
      setPermissionError(errorMessage(error));
    } finally {
      setPermissionsLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    auth
      .current()
      .then((identity) => {
        if (active) {
          setIdentity(identity);
          setPermissionsLoading(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const expired = () => setUser(null);
    window.addEventListener("securitas-session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("securitas-session-expired", expired);
    };
  }, [setUser]);
  useEffect(() => {
    if (user) void reloadPermissions();
  }, [user, reloadPermissions]);
  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        permissionsLoading,
        permissionError,
        receipts,
        setUser,
        reloadPermissions,
        can: (name) =>
          permissions.some((permission) => permission.name === name),
        addReceipt: (receipt) =>
          setReceipts((previous) => [receipt, ...previous]),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
