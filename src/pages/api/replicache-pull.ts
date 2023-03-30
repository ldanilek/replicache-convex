import { ConvexHttpClient } from 'convex/browser';
import { NextApiRequest, NextApiResponse } from 'next';
import { API } from '../../../convex/_generated/api';
import {defaultSpaceID} from './init';
import getLastMutationID from './replicache-push';

export default handlePull;

async function handlePull(req: NextApiRequest, res: NextApiResponse) {
  const pull = req.body;
  console.log(`Processing pull`, JSON.stringify(pull));
  const t0 = Date.now();

  const convex = new ConvexHttpClient<API>(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    // Read all data in a single transaction so it's consistent.
    res.json(await convex.query('processPull')({pull}));
    res.end();
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e.toString());
  } finally {
    console.log('Processed pull in', Date.now() - t0);
  }
}