---
title: "Markdown Formatting Test"
date: "2026-06-16T00:00:00Z"
draft: false
types:
  - Article
description: "Temporary article for verifying Markdown typography and theme styling."
summary: "Temporary test article for checking Markdown formatting in light and dark mode."
tags:
  - test
  - typography
topics:
  - test
  - typography
categories:
  - Testing
cover:
  image: "cover.jpg"
  icon: "cover-icon.jpg"
---

This temporary article exists to verify Markdown formatting, accent underlines, bold text, and highlighted text in both light and dark mode.

## Inline Formatting

Plain paragraph text should stay readable.

This is **bold text** and should render as bold without a yellow highlight.

This is *italic text* and should render as italic.

This is ***bold italic text*** and should render as both bold and italic.

This is ~~struck-through text~~ and should render with a strike.

This is ==highlighted text== and should render with the yellow highlight treatment.

This is <mark>HTML marked text</mark> and should match the Markdown highlight treatment.

This is `inline code` inside a sentence.

This sentence includes an [ordinary link](/posts/markdown-formatting-test/), an <u>underlined phrase</u>, and an <ins>inserted phrase</ins>.

This is an autolink: <https://example.com/>.

## Block Formatting

> This is a blockquote.
>
> It has a second paragraph and should keep the rough left rule.

---

### Lists

- Unordered item one
- Unordered item two with **bold**, ==highlight==, and [a link](/posts/markdown-formatting-test/)
- Unordered item three

1. Ordered item one
2. Ordered item two with `inline code`
3. Ordered item three

- [x] Completed task item
- [ ] Incomplete task item

### Code

```text
This is a fenced code block.
Bold markers like **this** should stay literal inside code.
Highlight markers like ==this== should stay literal inside code.
```

### Table

| Formatting | Markdown | Expected result |
|---|---|---|
| Bold | `**bold**` | **bold** |
| Italic | `*italic*` | *italic* |
| Highlight | `==highlight==` | ==highlight== |
| Link | `[link](/)` | [link](/) |
| Underline | `<u>underline</u>` | <u>underline</u> |
| Insert | `<ins>insert</ins>` | <ins>insert</ins> |
| Code | `` `code` `` | `code` |

## Footnote

This sentence has a footnote reference.[^formatting-note]

[^formatting-note]: This is the footnote content.
