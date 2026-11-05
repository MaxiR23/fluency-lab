import type { AuthSession } from "@/auth/auth-port";

export function toAuthSession(session: {
  access_token: string;
  user: { id: string; email?: string };
}): AuthSession {
  const email = session.user.email;
  return {
    accessToken: session.access_token,
    user: { id: session.user.id, email: email === undefined || email === "" ? null : email },
  };
}
