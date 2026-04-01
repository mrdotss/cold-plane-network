import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { testConnection } from "@/lib/aws/connection";
import { roleArnSchema } from "@/lib/cfm/validators";
import { z } from "zod";

const testConnectionSchema = z.object({
  roleArn: roleArnSchema,
  externalId: z.string().max(256).optional(),
});

/**
 * POST /api/cfm/test-connection
 *
 * Test an AWS connection by attempting STS AssumeRole with the provided
 * role ARN and optional external ID. Does NOT require an existing account.
 */
export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = await request.json();
    const parsed = testConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await testConnection(
      parsed.data.roleArn,
      parsed.data.externalId ?? null,
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 },
    );
  }
}
