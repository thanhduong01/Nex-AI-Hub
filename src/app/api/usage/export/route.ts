import { currentUser } from '@/lib/auth';
import { dbError } from '@/lib/errors';
import { rateLimit, failure } from '@/lib/http';
import { csv } from '@/lib/csv';
import { boundedExport } from '@/lib/export-data';
export async function GET() {
  try {
    const { db, member } = await currentUser();
    await rateLimit(`usage-export:${member.user_id}`, 10);
    const before = new Date().toISOString();
    const { count, error: countError } = await db
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .lte('created_at', before);
    dbError(countError);
    const data = await boundedExport(count || 0, async (from, to) => {
      const { data, error } = await db
        .from('runs')
        .select(
          'id,created_at,actor_id,model,status,reserved_cost,actual_cost,usage_state,input_tokens,output_tokens',
        )
        .lte('created_at', before)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to);
      dbError(error);
      return data || [];
    });
    const rows = [
      [
        'run_id',
        'time_utc',
        'actor_id',
        'model',
        'status',
        'reserved_usd',
        'actual_usd',
        'usage_state',
        'input_tokens',
        'output_tokens',
      ],
      ...(data || []).map((r) => [
        r.id,
        r.created_at,
        r.actor_id,
        r.model,
        r.status,
        r.reserved_cost,
        r.actual_cost,
        r.usage_state,
        r.input_tokens,
        r.output_tokens,
      ]),
    ];
    return new Response(csv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="nex-usage.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
