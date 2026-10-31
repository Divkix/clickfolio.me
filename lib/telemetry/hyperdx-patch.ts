// @hyperdx/browser 0.26 bundles this OTLP transformer. Its undefined resource/session
// values become empty AnyValues and its nonfinite doubles become JSON null; OpenObserve
// v1.1.2 rejects the whole batch. Patch the emitter, not just the receiving proxy.
const ORIGINAL_SERIALIZER =
  'function uL(e,t){return Object.keys(e).map((n=>function(e,t,n){return{key:e,value:lL(t,n)}}(n,e[n],t)))}function lL(e,t){const n=typeof e;if("string"===n)return{stringValue:e};if("number"===n)return Number.isInteger(e)?{intValue:e}:{doubleValue:e};if("boolean"===n)return{boolValue:e};if(e instanceof Uint8Array)return{bytesValue:t.encodeUint8Array(e)};if(Array.isArray(e)){const n=new Array(e.length);for(let r=0;r<e.length;r++)n[r]=lL(e[r],t);return{arrayValue:{values:n}}}if("object"===n&&null!=e){const n=Object.keys(e),r=new Array(n.length);for(let s=0;s<n.length;s++)r[s]={key:n[s],value:lL(e[n[s]],t)};return{kvlistValue:{values:r}}}return{}}';

const SAFE_SERIALIZER =
  'function uL(e,t){const n=[];for(const r of Object.keys(e)){const s=lL(e[r],t);if(void 0!==s)n.push({key:r.toWellFormed(),value:s})}return n}function lL(e,t){const n=typeof e;if("string"===n)return{stringValue:e.toWellFormed()};if("number"===n)return Number.isFinite(e)?Number.isSafeInteger(e)?{intValue:e}:{doubleValue:e}:void 0;if("boolean"===n)return{boolValue:e};if(e instanceof Uint8Array)return{bytesValue:t.encodeUint8Array(e)};if(Array.isArray(e)){const n=[];for(const r of e){const s=lL(r,t);if(void 0!==s)n.push(s)}return{arrayValue:{values:n}}}if("object"===n&&null!=e)return{kvlistValue:{values:uL(e,t)}};return void 0}';

/** Fail closed on SDK upgrades: remove each patch only after checking its replacement. */
export function patchHyperdxBrowser(code: string): string {
  const unload = 'addEventListener("unload"';

  if (!code.includes(unload) || !code.includes(ORIGINAL_SERIALIZER)) {
    throw new Error("@hyperdx/browser changed: review its pagehide and OTLP serialization patches");
  }

  return code
    .replace(unload, 'addEventListener("pagehide"')
    .replace(ORIGINAL_SERIALIZER, SAFE_SERIALIZER);
}
