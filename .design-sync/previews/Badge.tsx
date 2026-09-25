import { Badge } from "raumplan-ui";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Accepted</Badge>
    <Badge variant="secondary">Draft</Badge>
    <Badge variant="outline">Living room</Badge>
    <Badge variant="destructive">Error</Badge>
    <Badge variant="ghost">12 m²</Badge>
    <Badge variant="link">Details</Badge>
  </div>
);

export const StyleTags = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">Scandinavian</Badge>
    <Badge variant="outline">Japandi</Badge>
    <Badge variant="outline">Mid-century</Badge>
    <Badge variant="outline">Industrial</Badge>
  </div>
);
