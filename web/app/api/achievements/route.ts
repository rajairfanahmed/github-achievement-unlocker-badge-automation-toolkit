import { getAchievementsForWeb, noStoreJson } from '../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return noStoreJson(await getAchievementsForWeb());
}
