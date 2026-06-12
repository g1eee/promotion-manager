import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorResponse, parseJsonBody } from "@/api/http";
import { ValidationError } from "@/services/index";

const userStore: Record<string, { name: string }> = {};

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return errorResponse(
      new ValidationError("Nama wajib diisi.", { name: "Nama tidak boleh kosong." }),
    );
  }

  userStore[session.user.id] = { name };
  return NextResponse.json({ id: session.user.id, name, email: session.user.email ?? "" });
}
