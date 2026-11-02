// pdfjs-dist and epubjs are external, browser-only dynamic imports provided by
// the host app (see tsup.config.ts). They are not dependencies of this package,
// so declare them loosely here to keep the package type-checkable on its own.
declare module "pdfjs-dist" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any;
  export = pdfjs;
}

declare module "epubjs" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ePub: any;
  export default ePub;
}
