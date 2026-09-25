import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "raumplan-ui";

const rooms = [
  { value: "living", label: "Living room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "office", label: "Home office" },
];

export const Default = () => (
  <div className="flex flex-col gap-1.5">
    <Label>Room type</Label>
    <Select items={rooms} defaultValue="living">
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {rooms.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export const Placeholder = () => (
  <Select items={rooms}>
    <SelectTrigger className="w-56">
      <SelectValue placeholder="Choose a room" />
    </SelectTrigger>
    <SelectContent>
      {rooms.map((r) => (
        <SelectItem key={r.value} value={r.value}>
          {r.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const Small = () => (
  <Select items={rooms} defaultValue="bedroom">
    <SelectTrigger size="sm" className="w-44">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {rooms.map((r) => (
        <SelectItem key={r.value} value={r.value}>
          {r.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const Open = () => (
  <div className="h-64">
  <Select items={rooms} defaultValue="kitchen" defaultOpen>
    <SelectTrigger className="w-56">
      <SelectValue />
    </SelectTrigger>
    <SelectContent alignItemWithTrigger={false}>
      <SelectGroup>
        <SelectLabel>Living spaces</SelectLabel>
        <SelectItem value="living">Living room</SelectItem>
        <SelectItem value="kitchen">Kitchen</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Private</SelectLabel>
        <SelectItem value="bedroom">Bedroom</SelectItem>
        <SelectItem value="office">Home office</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
  </div>
);
