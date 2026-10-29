import { API, unwrap } from "./http";

export type User = {
  id: number; email: string; role: string; role_id: number;
  is_active: boolean; created_at?: string; updated_at?: string;
};
export type Permission = { id: number; name: string; description?: string };

export const auth = {
  async login(email: string, password: string): Promise<User> {
    const response = await API.post("/auth/login", { email, password });
    return unwrap<{ user: User }>(response).user;
  },
  async register(email: string, password: string, role_id?: number): Promise<User> {
    const response = await API.post("/auth/register", { email, password, ...(role_id ? { role_id } : {}) });
    return unwrap<User>(response);
  },
  async logout(): Promise<void> { await API.post("/auth/logout", {}); },
  async current(): Promise<User> { return unwrap<User>(await API.get("/auth/me")); },
  async permissions(): Promise<Permission[]> {
    return unwrap<{ permissions: Permission[] }>(await API.get("/rbac/get-my-permissions")).permissions;
  },
};
