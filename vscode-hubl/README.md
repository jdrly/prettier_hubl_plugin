# HubL Language Support for VS Code / Cursor

Provides syntax highlighting for HubL (HubSpot templating language) in various file types.

## Features

- **Syntax highlighting** for HubL blocks:
  - Statements: `{% ... %}`
  - Expressions: `{{ ... }}`
  - Comments: `{# ... #}`

- **Supported file types**:
  - `.hubl.html` - HubL embedded in HTML
  - `.hubl.css` - HubL embedded in CSS
  - Regular `.html` files with HubL content (via injection)
  - Regular `.css` files with HubL content (via injection)
  - Template literals in `.js`, `.jsx`, `.ts`, `.tsx` files

- **HubL-specific highlighting**:
  - Control flow keywords (`if`, `for`, `block`, etc.)
  - Built-in functions and filters
  - Variables and expressions
  - Strings and numbers
  - Operators

## Installation

### From VSIX

1. Download the `.vsix` file
2. In VS Code/Cursor: Extensions → ⋯ → Install from VSIX...
3. Select the downloaded file

### From Source

```bash
cd vscode-hubl
npm install
npm run compile
npm run package
```

Then install the generated `.vsix` file.

## File Associations

The extension automatically recognizes:

| File Extension | Language ID |
| -------------- | ----------- |
| `.hubl.html`   | hubl-html   |
| `.hubl.css`    | hubl-css    |

For regular HTML/CSS files containing HubL, the grammar injection provides highlighting without changing the file's language mode.

## Highlighting Examples

### HTML with HubL

```html
{% extends "./layouts/base.hubl.html" %}
{% block body %}
  <h1>{{ content.title }}</h1>
  {% for item in items %}
    <p>{{ item.name }}</p>
  {% endfor %}
{% endblock %}
```

### CSS with HubL

```css
.container {
  max-width: {{ theme.max_width }}px;
  {% if theme.use_dark_mode %}
  background: #000;
  color: #fff;
  {% endif %}
}
```

### Template Literals in JS/TS

```typescript
const template = `
  {% module "Hero" path="./Hero" %}
  <div>{{ content.title }}</div>
`;
```

## Color Customization

You can customize the HubL syntax colors in your VS Code settings:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "punctuation.definition.tag.begin.hubl",
        "settings": {
          "foreground": "#FF6B6B"
        }
      },
      {
        "scope": "keyword.control.hubl",
        "settings": {
          "foreground": "#4ECDC4"
        }
      },
      {
        "scope": "support.function.builtin.hubl",
        "settings": {
          "foreground": "#FFE66D"
        }
      }
    ]
  }
}
```

## Scope Names

| Scope | Description |
| ----- | ----------- |
| `punctuation.definition.tag.begin.hubl` | `{%` and `{{` |
| `punctuation.definition.tag.end.hubl` | `%}` and `}}` |
| `keyword.control.hubl` | Control keywords |
| `support.function.builtin.hubl` | Built-in functions |
| `support.function.filter.hubl` | Filter functions |
| `string.quoted.double.hubl` | Double-quoted strings |
| `string.quoted.single.hubl` | Single-quoted strings |
| `constant.language.boolean.hubl` | Boolean values |
| `constant.numeric.hubl` | Numbers |
| `variable.other.hubl` | Variables |
| `comment.block.hubl` | Comments |

## License

MIT
