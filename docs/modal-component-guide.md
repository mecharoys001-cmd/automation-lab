# Modal Component Guide

## Overview

The `Modal` component enforces the **sticky button pattern** for all modals in Symphonix Scheduler. Use this component for ALL new modals to ensure consistent UX.

## Pattern Enforcement

**Structure:**
```
┌─────────────────────────────┐
│  Header (sticky top)        │ ← shrink-0
├─────────────────────────────┤
│                             │
│  Body (scrollable)          │ ← flex-1 overflow-y-auto
│                             │
├─────────────────────────────┤
│  Footer (sticky bottom)     │ ← shrink-0
└─────────────────────────────┘
```

**Why this pattern:**
- ✅ X button always visible at top
- ✅ Action buttons always visible at bottom
- ✅ Long forms scroll smoothly
- ✅ Works on small screens

---

## Basic Usage

```tsx
import { Modal, ModalButton } from '../components/ui/Modal';

function MyModal({ open, onClose, data }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // ... save logic
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Item"
      width="600px"
      footer={
        <>
          <ModalButton onClick={onClose}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} loading={saving}>
            Save Changes
          </ModalButton>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <input type="text" />
        <textarea />
        {/* ... form fields ... */}
      </div>
    </Modal>
  );
}
```

---

## Props Reference

### Modal

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Whether modal is open |
| `onClose` | `() => void` | - | Called when modal should close |
| `title` | `string` | - | Modal title in header |
| `children` | `ReactNode` | - | Modal content (scrollable) |
| `footer` | `ReactNode` | `undefined` | Footer content (action buttons) |
| `width` | `string \| number` | `"600px"` | Modal width |
| `subtitle` | `string` | `undefined` | Optional subtitle below title |
| `disableBackdropClose` | `boolean` | `false` | Prevent closing on backdrop click |
| `className` | `string` | `""` | Additional CSS classes |

### ModalButton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger'` | `'secondary'` | Button style |
| `loading` | `boolean` | `false` | Show loading spinner |
| `icon` | `ReactNode` | `undefined` | Icon before text |
| ...all standard button props | | | `onClick`, `disabled`, etc. |

---

## Examples

### Simple Modal

```tsx
<Modal
  open={isOpen}
  onClose={handleClose}
  title="Confirm Action"
  footer={
    <>
      <ModalButton onClick={handleClose}>Cancel</ModalButton>
      <ModalButton variant="primary" onClick={handleConfirm}>Confirm</ModalButton>
    </>
  }
>
  <div className="p-6">
    <p>Are you sure you want to proceed?</p>
  </div>
</Modal>
```

### Form Modal with Delete

```tsx
import { Trash2, Save } from 'lucide-react';

<Modal
  open={isOpen}
  onClose={handleClose}
  title="Edit Event"
  subtitle="Make changes to this event"
  width="700px"
  footer={
    <>
      <ModalButton variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
        Delete
      </ModalButton>
      <div className="flex-1" /> {/* Spacer */}
      <ModalButton onClick={handleClose}>Cancel</ModalButton>
      <ModalButton variant="primary" icon={<Save className="w-4 h-4" />} onClick={handleSave} loading={saving}>
        Save Changes
      </ModalButton>
    </>
  }
>
  <form className="p-6 space-y-4">
    {/* Form fields */}
  </form>
</Modal>
```

### Confirmation Dialog (No Footer)

```tsx
<Modal
  open={isOpen}
  onClose={handleClose}
  title="Information"
  width="400px"
>
  <div className="p-6">
    <p>Your changes have been saved.</p>
    <button onClick={handleClose} className="mt-4 w-full">OK</button>
  </div>
</Modal>
```

---

## Migration Guide

### Existing Modals

To migrate existing modals:

1. **Import the Modal component:**
   ```tsx
   import { Modal, ModalButton } from '../components/ui/Modal';
   ```

2. **Replace your modal wrapper:**
   ```tsx
   // Before
   <div className="fixed inset-0 ...">
     <div className="... max-h-[calc(100vh-2rem)] flex flex-col">
       <div className="shrink-0">Header</div>
       <div className="flex-1 overflow-y-auto">Body</div>
       <div className="shrink-0">Footer</div>
     </div>
   </div>

   // After
   <Modal
     open={open}
     onClose={onClose}
     title="Your Title"
     footer={<>Your Buttons</>}
   >
     Your Content
   </Modal>
   ```

3. **Simplify button styles:**
   ```tsx
   // Before
   <button className="px-4 py-2 bg-blue-500 text-white ...">Save</button>

   // After
   <ModalButton variant="primary">Save</ModalButton>
   ```

---

## Best Practices

### ✅ DO:
- Use `Modal` for all new modals
- Put form content inside `children` with padding: `<div className="p-6">...</div>`
- Put action buttons in `footer` prop
- Use `ModalButton` for consistent styling
- Set appropriate `width` for content (default 600px is good for forms)

### ❌ DON'T:
- Create custom modal wrappers (use `Modal` instead)
- Put buttons inside modal body (use `footer` prop)
- Make modal wider than 800px (hard to read on large screens)
- Forget padding on content (`p-6` recommended)

---

## Accessibility

The Modal component includes:
- ✅ Focus trap (backdrop click closes modal)
- ✅ `aria-label` on close button
- ✅ Proper z-index layering
- ✅ ESC key support (via `onClose`)

**Future improvements:**
- Focus management (focus first input on open)
- ESC key listener
- `aria-modal` and `role="dialog"`

---

## Related Components

- **Tooltip** — for button tooltips
- **Badge** — for status indicators in modals
- **FormField** — for labeled form inputs

---

**For questions or improvements, see `/docs/` or ask the team.**
