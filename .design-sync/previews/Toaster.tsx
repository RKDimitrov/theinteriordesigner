import { useEffect } from "react";
import { Toaster, toast } from "raumplan-ui";

export const Default = () => {
  useEffect(() => {
    toast.success("Design generated", { description: "Scandinavian living room is ready to review." });
    toast.error("Could not save floor plan", { description: "Check your connection and try again." });
  }, []);
  return (
    <div className="h-64 w-96">
      <Toaster position="top-center" expand />
    </div>
  );
};
