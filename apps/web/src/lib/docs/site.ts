/** The site's own address, for absolute links in llms.txt and the Markdown pages. Set at build time, as for metadataBase. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/+$/, "");
}
