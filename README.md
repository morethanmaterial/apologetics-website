# More Than Material Website

This repository contains the source for the More Than Material website:

> Making the Christian case that reality is more than material.

## Project Structure

- `content/` - articles, pages, taxonomy content, and other written material.
- `layouts/` - site-specific Hugo templates and partial overrides.
- `assets/` - custom CSS, JavaScript, RoughJS/Rough Notation, and processed frontend assets.
- `themes/PaperMod/` - vendored PaperMod Hugo theme.
- `hugo.yaml` - Hugo configuration, menus, taxonomies, and site parameters.

## Development

This site requires Hugo Extended. The vendored PaperMod version requires Hugo
`0.146.0` or newer.

Common local commands:

```sh
hugo server
hugo --minify
```

## Licenses

This repository uses separate licenses for different kinds of material:

- Site code, configuration, templates, stylesheets, and scripts:
  [MIT License](LICENSE.md)
- Original written content:
  [Creative Commons Attribution 4.0 International](CONTENT-LICENSE.md)
- Names, logos, icons, channel artwork, and other brand-identifying assets:
  [Brand Asset License](BRAND-LICENSE.md)
- Third-party software notices for Hugo, PaperMod, RoughJS, and Rough Notation:
  [Dependency Licenses](DEPENDENCY-LICENSES.md)

See each license file for the exact scope and terms.
