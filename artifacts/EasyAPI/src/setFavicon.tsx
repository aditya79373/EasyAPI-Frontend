import { renderToStaticMarkup } from "react-dom/server";
import { Logo } from "./App"; // yahan apni Logo file ka sahi path daalo

export function setFavicon() {
  const html = renderToStaticMarkup(<Logo small />);
  const svg = html.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) return;

  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}