import { capsule, endpoint, json, query, string, table, text } from "lakebed/server";

export default capsule({
  schema: {
    profile: table({ snapshot: string(), generatedAt: string() }),
  },
  queries: {
    profile: query((ctx) => {
      const row = ctx.db.profile.orderBy("createdAt", "desc").limit(1).all()[0];
      return row ? JSON.parse(row.snapshot) : null;
    }),
  },
  endpoints: {
    ingest: endpoint({ method: "POST", path: "/ingest" }, async (ctx, req) => {
      if (req.headers.get("authorization") !== `Bearer ${ctx.env.INGEST_TOKEN}`) return text("unauthorized", { status: 401 });
      const snapshot = await req.json<{ generatedAt: string }>();
      ctx.db.profile.insert({ snapshot: JSON.stringify(snapshot), generatedAt: snapshot.generatedAt });
      return json({ ok: true, generatedAt: snapshot.generatedAt });
    }),
  },
});
