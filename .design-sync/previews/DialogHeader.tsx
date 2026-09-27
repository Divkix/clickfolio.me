import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@clickfolio/ui";

export const TitleAndDescription = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Switch to Midnight theme?</DialogTitle>
        <DialogDescription>
          Visitors to clickfolio.me/@janedoe will see the new theme right away. Your content stays
          exactly the same.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Apply theme</Button>
      </div>
    </DialogContent>
  </Dialog>
);
