import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/rbac/permissions";

export class UnauthorizedError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class SubscriptionPendingError extends Error {
  constructor(message = "Your account is awaiting approval from the platform owner before you can do that.") {
    super(message);
  }
}

/** Maps a thrown error to the right HTTP status in one place, for every API route's catch block. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SubscriptionPendingError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", issues: error.issues },
      { status: 400 }
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
