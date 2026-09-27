import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@clickfolio/ui";

export const Default = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Hide from search engines</DialogTitle>
        <DialogDescription>
          Google and other search engines will stop indexing clickfolio.me/@janedoe. Anyone with
          the link can still view your portfolio, and you stay listed in Explore unless you turn
          that off too.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save privacy settings</Button>
      </div>
    </DialogContent>
  </Dialog>
);
