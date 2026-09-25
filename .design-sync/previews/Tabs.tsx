import { Tabs, TabsContent, TabsList, TabsTrigger } from "raumplan-ui";

export const Default = () => (
  <Tabs defaultValue="plan" className="w-96">
    <TabsList>
      <TabsTrigger value="plan">Floor plan</TabsTrigger>
      <TabsTrigger value="design">Design</TabsTrigger>
      <TabsTrigger value="budget">Budget</TabsTrigger>
    </TabsList>
    <TabsContent value="plan" className="text-sm text-muted-foreground">
      4 rooms · 72.4 m² total · last edited today
    </TabsContent>
    <TabsContent value="design">Design</TabsContent>
    <TabsContent value="budget">Budget</TabsContent>
  </Tabs>
);

export const Line = () => (
  <Tabs defaultValue="living" className="w-96">
    <TabsList variant="line">
      <TabsTrigger value="living">Living room</TabsTrigger>
      <TabsTrigger value="bedroom">Bedroom</TabsTrigger>
      <TabsTrigger value="kitchen">Kitchen</TabsTrigger>
    </TabsList>
    <TabsContent value="living" className="text-sm text-muted-foreground">
      Sofa, coffee table, reading chair, floor lamp.
    </TabsContent>
    <TabsContent value="bedroom">Bedroom</TabsContent>
    <TabsContent value="kitchen">Kitchen</TabsContent>
  </Tabs>
);
