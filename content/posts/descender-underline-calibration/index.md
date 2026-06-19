---
title: "Descender Underline Calibration"
date: "2026-06-16T00:00:00Z"
draft: false
types:
  - Article
description: "Temporary typography test article for descender underline calibration."
summary: "Temporary test article for checking rough underlines around descender letters."
tags:
  - test
  - typography
topics:
  - test
  - typography
categories:
  - Testing
---

This temporary article exists to calibrate rough underlines around descender characters.

## g j p q y Q

The heading above checks heading underlines with every descender character currently handled by the rough underline code.

## Topics

This heading checks the common `p` case in a real word.

## Branding

This heading checks an ending `g`.

## Summary

This heading checks an ending `y`.

## Single Underlined Descenders

<u>g</u> <u>j</u> <u>p</u> <u>q</u> <u>y</u> <u>Q</u>

## Descenders At Word Start

<u>go</u> <u>joy</u> <u>plain</u> <u>quiet</u> <u>young</u> <u>Question</u>

## Descenders In Word Middles

<u>again</u> <u>adjust</u> <u>topic</u> <u>equal</u> <u>layer</u> <u>aQa</u>

## Descenders At Word End

<u>bag</u> <u>haj</u> <u>tap</u> <u>faq</u> <u>day</u> <u>FAQ</u>

## Repeated Descenders

<u>gggggg</u>

<u>jjjjjj</u>

<u>pppppp</u>

<u>qqqqqq</u>

<u>yyyyyy</u>

<u>QQQQQQ</u>

## Mixed Descender Runs

<u>gjpqyQ</u>

<u>g j p q y Q</u>

<u>ag aj ap aq ay aQ</u>

<u>ga ja pa qa ya Qa</u>

## Link Underlines

[g](/posts/descender-underline-calibration/) [j](/posts/descender-underline-calibration/) [p](/posts/descender-underline-calibration/) [q](/posts/descender-underline-calibration/) [y](/posts/descender-underline-calibration/) [Q](/posts/descender-underline-calibration/)

[go](/posts/descender-underline-calibration/) [joy](/posts/descender-underline-calibration/) [topic](/posts/descender-underline-calibration/) [quiet](/posts/descender-underline-calibration/) [day](/posts/descender-underline-calibration/) [FAQ](/posts/descender-underline-calibration/)

## Inline Sentence Tests

The <u>g</u> in <u>again</u> should not remove the whole underline under the letter.

The <u>j</u> in <u>adjust</u> should leave only a narrow descender gap.

The <u>p</u> in <u>Topics</u> should gap around the stem, not the whole bowl.

The <u>q</u> in <u>quiet</u> should bias the gap toward the descending stroke.

The <u>y</u> in <u>Summary</u> should avoid an odd ending segment.

The <u>Q</u> in <u>Question</u> should avoid over-cutting the letter.

## Table Tests

| Character | Start | Middle | End | Repeated |
|---|---|---|---|---|
| <u>g</u> | <u>go</u> | <u>again</u> | <u>bag</u> | <u>gggggg</u> |
| <u>j</u> | <u>joy</u> | <u>adjust</u> | <u>haj</u> | <u>jjjjjj</u> |
| <u>p</u> | <u>plain</u> | <u>topic</u> | <u>tap</u> | <u>pppppp</u> |
| <u>q</u> | <u>quiet</u> | <u>equal</u> | <u>faq</u> | <u>qqqqqq</u> |
| <u>y</u> | <u>young</u> | <u>layer</u> | <u>day</u> | <u>yyyyyy</u> |
| <u>Q</u> | <u>Question</u> | <u>aQa</u> | <u>FAQ</u> | <u>QQQQQQ</u> |
