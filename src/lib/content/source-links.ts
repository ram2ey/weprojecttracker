export function sourceParts(source: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const urls = /https?:\/\/[^\s<>"']+/gi;
  let start = 0;
  for (const match of source.matchAll(urls)) {
    const text = match[0]
      .replace(/[.,;:!?]+$/, "")
      .replace(/\)$/, (ending) =>
        (match[0].match(/\(/g)?.length ?? 0) <
        (match[0].match(/\)/g)?.length ?? 0)
          ? ""
          : ending,
      );
    if (match.index! > start)
      parts.push({ text: source.slice(start, match.index) });
    let href: string | undefined;
    try {
      const url = new URL(text);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        href = url.href;
    } catch {}
    parts.push({ text, href });
    start = match.index! + text.length;
  }
  if (start < source.length) parts.push({ text: source.slice(start) });
  return parts;
}
