import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icons,
} from "@clickfolio/ui";

export const OpenFromButton = () => (
  <div className="flex flex-col items-start gap-4 p-6">
    <Dialog defaultOpen modal={false}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Icons.Pencil className="size-4" />
          Change handle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Change your handle?</DialogTitle>
          <DialogDescription>
            Your portfolio will move to clickfolio.me/@jane-builds. You can change your handle 3
            times per day.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Confirm change</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
);

export const Closed = () => (
  <div className="flex items-center gap-3 p-6">
    <Dialog>
      <DialogTrigger asChild>
        <Button>Publish portfolio</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish your portfolio?</DialogTitle>
          <DialogDescription>It goes live at clickfolio.me/@janedoe.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Change handle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your handle?</DialogTitle>
          <DialogDescription>Pick a new handle for your portfolio.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  </div>
);
