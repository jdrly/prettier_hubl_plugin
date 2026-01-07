# @jdrly/prettier-plugin-hubl

A Prettier plugin for formatting HubL (HubSpot templating language) in HTML, CSS, JSX, and TSX files.

## Features

- **One block per line**: Separates multiple HubL blocks that are on the same line
- **Whitespace normalization**: Cleans up irregular spacing inside blocks
- **Module formatting**: Intelligently wraps long `{% module %}` statements with indented arguments
- **Comma preservation**: Preserves commas between arguments if present in the original
- **Safe HTML handling**: Skips formatting for HubL control flow inside HTML start tags

## Installation

```bash
npm install --save-dev @jdrly/prettier-plugin-hubl
```

## Configuration

Add the plugin to your Prettier configuration:

```json
{
  "plugins": ["@jdrly/prettier-plugin-hubl"],
  "printWidth": 80,
  "tabWidth": 2
}
```

## Supported File Types

| Extension      | Description                  |
| -------------- | ---------------------------- |
| `.hubl.html`   | HubL embedded in HTML        |
| `.hubl.css`    | HubL embedded in CSS         |

## Formatting Rules

### HubL Block Types

The plugin recognizes three types of HubL blocks:

- **Statements**: `{% ... %}` - Control flow, modules, macros
- **Expressions**: `{{ ... }}` - Output values
- **Comments**: `{# ... #}` - Comments

### Module Formatting

Module statements are formatted with special rules:

**Single line** (if within `printWidth`):

```hubl
{% module "HeroSection" path="../components/modules/HeroSection" no_wrapper=True %}
```

**Multi-line** (if exceeds `printWidth`):

```hubl
{% module "QuoteHeading"
  path="../components/modules/QuoteHeading"
  showBadges=false
  showHeading=false
  showTagline=true
  no_wrapper=True 
%}
```

### Comma Preservation

The plugin preserves commas between arguments only if they were present in the original:

**With commas** (preserved):

```hubl
{% module "Name" path="../path", no_wrapper=True %}
```

**Without commas** (no commas added):

```hubl
{% module "Name" path="../path" no_wrapper=True %}
```

### Skip Formatting

The plugin skips formatting for HubL control flow inside HTML start tags to avoid breaking attribute-building patterns:

```html
<!-- This pattern is preserved verbatim -->
<a
  href="{{ blog.absolute_url }}"
  {% if not tag %}class="active"
  {% else %}class="inactive"
  {% endif %}
>Link</a>
```

## Example Transformation

**Before:**

```hubl
{% set my_tags = blog_tags('default', 250) %} {% extends "./layouts/base.hubl.html" %} {% block body no_wrapper=True %}
{% module "HeroSection" path="../components/modules/HeroSection" enable, no_wrapper=True %} {% module "QuoteHeading"
path="../components/modules/QuoteHeading" showBadges=false, showHeading=false, showTagline=true, no_wrapper=True %}
```

**After:**

```hubl
{% set my_tags = blog_tags('default', 250) %}
{% extends "./layouts/base.hubl.html" %}
{% block body no_wrapper=True %}
{% module "HeroSection" path="../components/modules/HeroSection" enable, no_wrapper=True %}
{% module "QuoteHeading"
  path="../components/modules/QuoteHeading"
  showBadges=false,
  showHeading=false,
  showTagline=true,
  no_wrapper=True 
%}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## License

MIT
