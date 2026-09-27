import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@clickfolio/ui";

export const Open = () => (
  <Dialog defaultOpen modal={false}>
    <DialogTrigger asChild>
      <Button variant="outline">Change handle</Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Change your handle?</DialogTitle>
        <DialogDescription>
          Your portfolio will move to clickfolio.me/@jane-builds. The old link stops working, and
          you can change your handle 3 times per day.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Confirm change</Button>
      </div>
    </DialogContent>
  </Dialog>
);
