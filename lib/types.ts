export type Role = "user" | "merchant" | "admin";

export interface Profile {
  id: string;
  role: Role;
  name: string;
}
