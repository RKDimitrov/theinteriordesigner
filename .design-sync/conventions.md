## RaumplanUI conventions (read first)

RaumplanUI is the component layer of RaumPlan, an AI interior-design app. The components are shadcn/ui (style "base-nova") on top of Base UI, styled with Tailwind CSS v4 utility classes and CSS-variable tokens. The look is neutral and minimal: near-black primary, white cards, hairline borders and the Geist font.

### Setup
- No provider is needed. Link `styles.css` and the components are styled.
- Base UI overlays (`Dialog`, `Select`, `Tooltip`) portal to `document.body`. `Tooltip` requires `<TooltipProvider>` above it; wrap the page in one.
- For notifications, render `<Toaster />` once at the root and call `RaumplanUI.toast("Saved")`, `toast.success(title, { description })` or `toast.error(...)`.
- Dark mode: add `class="dark"` on `<html>` and every token switches.

### Styling idiom: Tailwind utilities + semantic tokens
Use semantic token classes, not raw colors:
| Purpose | Classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-muted`, `bg-secondary`, `bg-accent`, `bg-popover` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-destructive`, `text-primary` |
| Borders | `border`, `border-border`, `border-input` |
| Emphasis | `bg-primary text-primary-foreground`, `bg-destructive` |
| Radius | `rounded-md`, `rounded-lg`, `rounded-xl` (scale from `--radius: 0.625rem`) |
| Type | `text-xs`…`text-3xl`, `font-medium`, `font-semibold`, `tracking-tight`, `font-mono` |
| Layout | `flex`, `grid`, `grid-cols-1…4`, `md:grid-cols-2/3`, `gap-1…12`, `p-*`, `px-*`, `py-*`, `space-y-*`, `max-w-md…7xl`, `mx-auto`, `w-full` |

Only classes compiled into `_ds_bundle.css` exist. Arbitrary values like `w-[437px]` and unused palette colors won't resolve, so use `style={{…}}` for one-off values. Raw tokens are available as CSS variables: `var(--primary)`, `var(--muted-foreground)`, `var(--border)`, `var(--radius)` and so on.

The app's typical form field is a `flex flex-col gap-1.5` stack containing a `Label`, a control, and a hint (`text-xs text-muted-foreground`) or an error (`text-xs text-destructive`). Mark an invalid control with `aria-invalid`.

### Components and compound parts
- `Button`: `variant` default | secondary | outline | ghost | destructive | link; `size` xs | sm | default | lg | icon | icon-xs | icon-sm | icon-lg.
- `Badge`: `variant` default | secondary | outline | destructive | ghost | link.
- `Card` (`size` default | sm) contains `CardHeader` (holding `CardTitle`, `CardDescription` and an optional `CardAction`), then `CardContent` and `CardFooter`.
- `Alert` (`variant` default | destructive) contains `AlertTitle`, `AlertDescription` and an optional `AlertAction`.
- `Dialog` contains `DialogTrigger` and `DialogContent` (`showCloseButton`). Inside `DialogContent` go `DialogHeader` (`DialogTitle`, `DialogDescription`) and `DialogFooter`, plus `DialogClose` where needed.
- `Select` (`items`, `defaultValue`) contains `SelectTrigger` (`size` sm | default) with `SelectValue` (`placeholder`), then `SelectContent` holding `SelectItem`s (optionally inside `SelectGroup`/`SelectLabel` and split by `SelectSeparator`).
- `Tabs` contains `TabsList` (`variant` default | line) with `TabsTrigger`s, followed by `TabsContent` panels.
- `RadioGroup` contains `RadioGroupItem`s. `Checkbox`, `Slider` (value arrays: `[60]`, `[200, 1200]`), `Input`, `Textarea`, `Label` and `Separator` (`orientation`) stand alone.
- To make a trigger look like a Button, use Base UI's `render` prop: `<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>`.

Per-component examples are in `components/general/<Name>/<Name>.prompt.md`.

### Example
```jsx
const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } = window.RaumplanUI;

<div className="mx-auto grid max-w-5xl gap-4 p-6 md:grid-cols-3">
  <Card>
    <CardHeader>
      <CardTitle>Scandinavian living room</CardTitle>
      <CardDescription>Light oak, linen and warm neutrals.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-wrap gap-2">
      <Badge variant="outline">24.5 m²</Badge>
      <Badge variant="secondary">Draft</Badge>
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="outline">Regenerate</Button>
      <Button>Accept</Button>
    </CardFooter>
  </Card>
</div>
```
