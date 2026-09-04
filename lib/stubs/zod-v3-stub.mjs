// The AI SDK (@ai-sdk/provider-utils) imports ZodFirstPartyTypeKind from "zod/v3"
// for its zod3-to-json-schema converter. Since this project only uses Zod v4 schemas,
// the v3 code path never executes at runtime (guarded by isZod4Schema check).

export const ZodFirstPartyTypeKind = {
  ZodString: "ZodString",
  ZodNumber: "ZodNumber",
  ZodNaN: "ZodNaN",
  ZodBigInt: "ZodBigInt",
  ZodBoolean: "ZodBoolean",
  ZodDate: "ZodDate",
  ZodSymbol: "ZodSymbol",
  ZodUndefined: "ZodUndefined",
  ZodNull: "ZodNull",
  ZodAny: "ZodAny",
  ZodUnknown: "ZodUnknown",
  ZodNever: "ZodNever",
  ZodVoid: "ZodVoid",
  ZodArray: "ZodArray",
  ZodObject: "ZodObject",
  ZodUnion: "ZodUnion",
  ZodDiscriminatedUnion: "ZodDiscriminatedUnion",
  ZodIntersection: "ZodIntersection",
  ZodTuple: "ZodTuple",
  ZodRecord: "ZodRecord",
  ZodMap: "ZodMap",
  ZodSet: "ZodSet",
  ZodFunction: "ZodFunction",
  ZodLazy: "ZodLazy",
  ZodLiteral: "ZodLiteral",
  ZodEnum: "ZodEnum",
  ZodEffects: "ZodEffects",
  ZodNativeEnum: "ZodNativeEnum",
  ZodOptional: "ZodOptional",
  ZodNullable: "ZodNullable",
  ZodDefault: "ZodDefault",
  ZodCatch: "ZodCatch",
  ZodPromise: "ZodPromise",
  ZodBranded: "ZodBranded",
  ZodPipeline: "ZodPipeline",
  ZodReadonly: "ZodReadonly",
};

const z = { ZodFirstPartyTypeKind };
export { z };
export default z;
