import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import demo from '../../../../../../packages/demo/examples/citybean-coffee.json' assert { type: 'json' };

export const GET: RequestHandler = async () => {
  return json(demo);
};

