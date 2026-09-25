import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from "raumplan-ui";

export const Default = () => (
  <Alert className="w-96">
    <AlertTitle>Floor plan saved</AlertTitle>
    <AlertDescription>All 4 rooms passed dimension checks. You can now generate a design.</AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" className="w-96">
    <AlertTitle>Design could not be generated</AlertTitle>
    <AlertDescription>The bedroom is smaller than the minimum bed footprint (140 × 200 cm).</AlertDescription>
  </Alert>
);

export const WithAction = () => (
  <Alert className="w-96">
    <AlertTitle>New trends available</AlertTitle>
    <AlertDescription>Autumn 2026 palette research finished.</AlertDescription>
    <AlertAction>
      <Button size="xs" variant="outline">
        View
      </Button>
    </AlertAction>
  </Alert>
);
