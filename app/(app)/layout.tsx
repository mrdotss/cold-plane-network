import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

const SESSION_COOKIE_NAME = "session_token";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/login");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const userData = {
    name: user?.username ?? "User",
    email: user?.username ? `${user.username}` : "",
  };

  return (
    <SidebarProvider>
      <AppSidebar user={userData} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
