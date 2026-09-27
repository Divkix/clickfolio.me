import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@clickfolio/ui";

export const PublishConfirm = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Publish your portfolio?</DialogTitle>
        <DialogDescription>
          Your portfolio goes live at clickfolio.me/@janedoe with the Minimalist Editorial theme.
          You can switch themes or unpublish any time.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Keep editing</Button>
        <Button>Publish now</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export const DeleteAccount = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()} showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Delete your account</DialogTitle>
        <DialogDescription>
          This permanently removes your resume, portfolio and analytics. clickfolio.me/@janedoe
          will stop working immediately.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete account</Button>
      </div>
    </DialogContent>
  </Dialog>
);
