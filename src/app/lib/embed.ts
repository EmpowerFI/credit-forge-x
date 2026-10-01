// PostgREST decides an embed's shape from the schema, not from the query.
//
// `…, loans(…)` arrives as a single object because `loans.opportunity_id` is
// unique; `…, partner_decisions(…)` arrives as an array because nothing says a
// decision is singular. The query text is identical in both cases, so the shape
// is a property of a constraint the client cannot see — and a hand-written type
// is free to be wrong about it.
//
// One was. The entrepreneur's own page typed her loan as an array and read
// `loans[0]`, which on an object is `undefined`: her running loan did not exist
// on her page at all. The credit journey stopped at formalisation, and
// `loans.length` being undefined too kept "Withdraw the request" on screen for a
// loan she had been repaying for three months — so her own two screens read as
// two different people's. `tsc` cannot catch it, because the type was the lie.
//
// Reading either shape is what stops a screen depending on a decision taken in
// the schema. Where the relationship really is to-many, the first row is what a
// caller asking for `one` wants.
export const one = <T,>(embed: T | T[] | null | undefined): T | null =>
  Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null);
