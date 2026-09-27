import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@clickfolio/ui";

export const Default = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Retry resume parsing</DialogTitle>
        <DialogDescription>
          We couldn&apos;t read Jane_Doe_Resume.pdf on the first try. You have 2 retries left
          today.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Upload a different file</Button>
        <Button>Retry now</Button>
      </div>
    </DialogContent>
  </Dialog>
);
