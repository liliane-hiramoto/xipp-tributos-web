import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: o antigo "middleware" agora se chama "proxy" (runtime Node.js).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclui assets estáticos (inclui o worker .js do pdf.js e o HTML standalone).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|html|js|css|txt|woff2?|map)$).*)",
  ],
};
