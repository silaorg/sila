import type { RequestHandler } from './$types';
import { getAuth } from '$lib/server/auth';

const handle: RequestHandler = async ({ request }) => {
	const auth = await getAuth();
	return auth.handler(request);
};

export { handle as GET, handle as POST };
