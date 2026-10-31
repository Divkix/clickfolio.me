import { useEffect } from "react";

export function consumeAccountDeletionNotice() {
  const url = new URL(window.location.href);

  if (url.searchParams.get("account_deleted") !== "1") return false;

  url.searchParams.delete("account_deleted");
  window.history.replaceState(window.history.state, "", url);

  return true;
}

export function AccountDeletedNotice() {
  useEffect(() => {
    if (!consumeAccountDeletionNotice()) return;

    void import("sonner").then(({ toast }) =>
      toast.success("Your account was deleted and your public page was removed.", {
        description:
          "Diagnostics expire within 90 days of collection. See our Privacy Policy for details.",
        duration: 10000,
      }),
    );
  }, []);

  return null;
}
