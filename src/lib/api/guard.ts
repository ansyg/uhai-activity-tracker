import { getCurrentUserId } from "@/lib/auth/session";
import { UnauthorizedError } from "./errors";

/** Every authenticated route starts with this. Throws 401 if there's no valid session. */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
