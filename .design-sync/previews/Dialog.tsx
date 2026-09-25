import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "raumplan-ui";

export const Confirm = () => (
  <Dialog defaultOpen>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete apartment?</DialogTitle>
        <DialogDescription>
          This removes “Altbau Kreuzberg”, its 4 rooms and all generated designs. This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button variant="destructive">Delete apartment</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
