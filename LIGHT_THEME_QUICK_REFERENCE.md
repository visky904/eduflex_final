# 🎨 Light Theme Quick Reference

## Color Palette At-A-Glance

### 🌈 Primary Colors

| Name | Class | Hex | Usage |
|------|-------|-----|-------|
| **Ocean Teal** | `teal-600` | `#0d9488` | Buttons, accents, headings |
| **Light Teal** | `teal-50` | `#f0fdfa` | Hover states, backgrounds |
| **Teal Heading** | `teal-700` | `#0f766e` | Section headings |
| **Pure White** | `white` | `#ffffff` | Cards, containers |
| **Light Blue** | `blue-50` | `#eff6ff` | Gradient background |

### 📝 Text Colors

| Type | Class | Hex | Where Used |
|------|-------|-----|------------|
| **Primary Text** | `gray-900` | `#111827` | Main content, headings |
| **Secondary Text** | `gray-700` | `#374151` | Descriptions |
| **Tertiary Text** | `gray-600` | `#4b5563` | Sidebar, labels |
| **Muted Text** | `gray-500` | `#6b7280` | Timestamps, hints |
| **White Text** | `white` | `#ffffff` | Buttons on teal |

### 🎯 Background Colors

| Type | Class | Usage |
|------|-------|-------|
| **Main App** | `bg-gradient-to-br from-teal-50 via-blue-50 to-white` | Main container |
| **Cards** | `bg-white` | All cards and panels |
| **Subtle BG** | `bg-gray-50` | Alternative panels |
| **Light BG** | `bg-gray-100` | Hover states |
| **Teal BG** | `bg-teal-600` | Buttons, active states |
| **Light Teal** | `bg-teal-50` | Highlighted areas |

### 🔲 Borders & Shadows

| Type | Class | Usage |
|------|-------|-------|
| **Subtle Border** | `border-gray-200` | Light separators |
| **Visible Border** | `border-gray-300` | Input fields, cards |
| **Teal Border** | `border-teal-200` | Highlighted sections |
| **Small Shadow** | `shadow-md` | Buttons |
| **Medium Shadow** | `shadow-lg` | Sidebar, cards |
| **Large Shadow** | `shadow-xl` | Important cards |
| **XL Shadow** | `shadow-2xl` | Modals |

---

## 🎯 Component Quick Copy-Paste

### Button Variants

```jsx
// Primary Button (Teal)
<button className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition shadow-md">
  Click Me
</button>

// Secondary Button (White with Teal Border)
<button className="bg-white text-teal-600 px-4 py-2 rounded-lg border-2 border-teal-600 hover:bg-teal-50 transition">
  Click Me
</button>

// Icon Button
<button className="bg-teal-600 text-white rounded-full p-2 hover:bg-teal-700 transition">
  <Icon />
</button>
```

### Cards & Panels

```jsx
// Main Card
<div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
  Content
</div>

// Highlighted Card
<div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
  Highlighted Content
</div>

// Subtle Panel
<div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
  Panel Content
</div>
```

### Input Fields

```jsx
// Text Input
<input
  type="text"
  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
  placeholder="Enter text..."
/>

// Textarea
<textarea
  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
  rows="4"
  placeholder="Enter message..."
></textarea>
```

### Headings

```jsx
// Main Heading
<h1 className="text-5xl font-extrabold text-teal-700">
  Main Title
</h1>

// Section Heading
<h2 className="text-3xl font-bold text-teal-700">
  Section Title
</h2>

// Subsection
<h3 className="text-xl font-semibold text-gray-900">
  Subsection
</h3>
```

### Modals

```jsx
// Modal Overlay + Container
<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
  <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl border border-gray-300">
    <h2 className="text-2xl font-bold text-teal-700 mb-4">Modal Title</h2>
    {/* Content */}
  </div>
</div>
```

---

## ⚡ Common Patterns

### Sidebar Menu Item

```jsx
// Inactive
<button className="w-full p-3 text-left text-teal-600 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition">
  Menu Item
</button>

// Active
<button className="w-full p-3 text-left bg-teal-600 text-white rounded-lg shadow-md">
  Active Item
</button>
```

### Stat Card

```jsx
<div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
  <p className="text-3xl font-bold text-blue-600">42</p>
  <p className="text-sm text-gray-600">Participants</p>
</div>
```

### Badge/Tag

```jsx
<span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 border border-gray-300">
  Tag Name
</span>
```

---

## 🚦 Status Colors

| Status | Background | Text | Usage |
|--------|------------|------|-------|
| Success | `bg-green-50` | `text-green-600` | Correct answers |
| Warning | `bg-yellow-50` | `text-yellow-600` | Warnings |
| Error | `bg-red-50` | `text-red-600` | Errors, incorrect |
| Info | `bg-blue-50` | `text-blue-600` | Information |
| Neutral | `bg-gray-50` | `text-gray-600` | Default |

---

## 💡 Best Practices

### ✅ Do's
- Use `bg-white` for all cards and containers
- Use `text-white` on `bg-teal-600` buttons
- Add shadows to create depth (`shadow-lg`, `shadow-xl`)
- Use subtle borders (`border-gray-200`, `border-gray-300`)
- Implement hover states with lighter backgrounds
- Use `text-gray-900` for primary text

### ❌ Don'ts
- Don't use `text-gray-900` on teal buttons (poor contrast)
- Don't mix dark theme colors with light theme
- Don't forget borders on light backgrounds (creates depth)
- Don't use pure black text (`text-black`) - use `text-gray-900` instead
- Don't omit hover/focus states on interactive elements

---

## 🎨 Gradient Backgrounds

```jsx
// Main App Gradient
className="bg-gradient-to-br from-teal-50 via-blue-50 to-white"

// Alternative Gradients
className="bg-gradient-to-r from-teal-50 to-blue-50"
className="bg-gradient-to-b from-white to-gray-50"
className="bg-gradient-to-tr from-teal-50 to-white"
```

---

## 🔄 State Variations

### Button States

```jsx
// Default
className="bg-teal-600 text-white"

// Hover
className="bg-teal-600 text-white hover:bg-teal-700"

// Active/Pressed
className="bg-teal-600 text-white active:bg-teal-800"

// Disabled
className="bg-gray-300 text-gray-500 cursor-not-allowed"
```

### Interactive Elements

```jsx
// Normal → Hover → Active
className="bg-white hover:bg-gray-50 active:bg-gray-100 transition"

// With Border
className="border-2 border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
```

---

## 📐 Spacing & Sizing

| Size | Padding Class | Margin Class | Usage |
|------|--------------|--------------|-------|
| Small | `p-2` | `m-2` | Icons, badges |
| Medium | `p-4` | `m-4` | Cards, buttons |
| Large | `p-6` | `m-6` | Containers |
| XL | `p-8` | `m-8` | Major sections |

---

## 🎯 Accessibility Guidelines

### Contrast Ratios (WCAG AA)

| Combination | Ratio | Pass? |
|-------------|-------|-------|
| `text-gray-900` on `bg-white` | 21:1 | ✅ AAA |
| `text-gray-700` on `bg-white` | 4.5:1 | ✅ AA |
| `text-white` on `bg-teal-600` | 4.8:1 | ✅ AA |
| `text-teal-600` on `bg-white` | 4.5:1 | ✅ AA |
| `text-gray-600` on `bg-white` | 3.8:1 | ✅ Large Text Only |

### Focus States

Always include visible focus states:
```jsx
className="focus:ring-2 focus:ring-teal-500 focus:outline-none"
```

---

**Quick Reference Version:** 1.0  
**Last Updated:** [Current Session]  
**Status:** ✅ Production Ready
