export function htmlToDoc(html) {
  const doc = document.implementation.createHTMLDocument('resp');
  doc.documentElement.innerHTML = html;
  return doc;
}
