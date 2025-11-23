"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  variant?: "default" | "ghost" | "sidebar";
}

export function LogoutButton({ variant = "default" }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Sidebar variant for navigation
  if (variant === "sidebar" || variant === "ghost") {
    return (
      <Button
        onClick={handleLogout}
        variant="ghost"
        className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors duration-300"
      >
        <LogOut className="w-5 h-5 mr-3" />
        Sign Out
      </Button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 text-slate-700 hover:text-slate-900 transition-colors"
    >
      Sign out
    </button>
  );
}
