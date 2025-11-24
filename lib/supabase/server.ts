import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ENV } from "../env";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(ENV.SUPABASE_URL(), ENV.SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie setting can fail in Server Components
          // This is expected and handled by middleware
        }
      },
    },
  });
}
