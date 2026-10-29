import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import { auth, errorMessage } from "../api/client";
import type { User, Permission, UploadReceipt } from "../api/client";

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [receipts, setReceipts] = useState<UploadReceipt[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const identity = await auth.current();
      setUser(identity);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setPermissionsLoading(false);
      return;
    }

    setPermissionsLoading(true);

    try {
      const result = await auth.permissions();
      setPermissions(result);
      setPermissionError("");
    } catch (error) {
      setPermissions([]);
      setPermissionError(errorMessage(error));
    } finally {
      setPermissionsLoading(false);
    }
  }, [user]);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setPermissions([]);
    setPermissionsLoading(false);
    setPermissionError("");
    setReceipts([]);
  }, []);

  useEffect(() => {
    void fetchUser();

    window.addEventListener(
      "securitas-session-expired",
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        "securitas-session-expired",
        handleSessionExpired
      );
    };
  }, [fetchUser, handleSessionExpired]);

  useEffect(() => {
    void reloadPermissions();
  }, [reloadPermissions]);

  const can = (name: string) =>
    permissions.some((permission) => permission.name === name);

  const addReceipt = (receipt: UploadReceipt) => {
    setReceipts((previous) => [receipt, ...previous]);
  };

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
        can,
        addReceipt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}