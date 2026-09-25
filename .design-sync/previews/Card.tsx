import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "raumplan-ui";

export const Default = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle>Scandinavian living room</CardTitle>
      <CardDescription>Light oak, linen textures and a warm neutral palette.</CardDescription>
      <CardAction>
        <Badge variant="secondary">Draft</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        3-seat sofa facing the window wall, round coffee table, reading chair in the north corner. All
        walkways keep at least 90 cm clearance.
      </p>
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="outline">Regenerate</Button>
      <Button>Accept design</Button>
    </CardFooter>
  </Card>
);

export const Small = () => (
  <Card size="sm" className="w-80">
    <CardHeader>
      <CardTitle>Budget</CardTitle>
      <CardDescription>€4,200 of €5,000 allocated</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Largest item: sofa (€1,450).</p>
    </CardContent>
  </Card>
);

export const WithIssues = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle>Validation issues</CardTitle>
      <CardDescription>2 problems found in this layout.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge variant="destructive">Error</Badge>
        <span>Wardrobe blocks the bedroom door swing.</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Warning</Badge>
        <span>Desk faces away from the window.</span>
      </div>
    </CardContent>
  </Card>
);
