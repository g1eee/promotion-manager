"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/ui";

/**
 * Sign-out control for the top app bar (Task 3.2).
 *
 * Ends the current session and returns the user to the login page. It is a
 * small client component so the {@link TopBar} can stay a server component:
 * the layout injects this into the TopBar's `signOutSlot`.
 */
export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void signOut({ callbackUrl: "/login" });
      }}
    >
      Keluar
    </Button>
  );
}
