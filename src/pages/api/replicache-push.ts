import { ConvexHttpClient } from 'convex/browser';
import { NextApiRequest, NextApiResponse } from 'next';
import Pusher from 'pusher';
import { API } from '../../../convex/_generated/api.js';
import {defaultSpaceID} from './init';

export default handlePush;

async function handlePush(req: NextApiRequest, res: NextApiResponse) {
  const push = req.body;
  console.log('Processing push', JSON.stringify(push));

  const convex = new ConvexHttpClient<API>(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const t0 = Date.now();
  try {
    // Iterate each mutation in the push.
    for (const mutation of push.mutations) {
      const t1 = Date.now();

      try {
        await convex.mutation('processMutation')({
            clientID: push.clientID,
            spaceID: defaultSpaceID,
            mutation,
        });
      } catch (e: any) {
        console.error('Caught error from mutation', mutation, e);

        // Handle errors inside mutations by skipping and moving on. This is
        // convenient in development but you may want to reconsider as your app
        // gets close to production:
        //
        // https://doc.replicache.dev/server-push#error-handling
        //
        // Ideally we would run the mutator itself in a nested transaction, and
        // if that fails, rollback just the mutator and allow the lmid and
        // version updates to commit. However, nested transaction support in
        // Postgres is not great:
        //
        // https://postgres.ai/blog/20210831-postgresql-subtransactions-considered-harmful
        //
        // Instead we implement skipping of failed mutations by *re-runing*
        // them, but passing a flag that causes the mutator logic to be skipped.
        //
        // This ensures that the lmid and version bookkeeping works exactly the
        // same way as in the happy path. A way to look at this is that for the
        // error-case we replay the mutation but it just does something
        // different the second time.
        //
        // This is allowed in Replicache because mutators don't have to be
        // deterministic!:
        //
        // https://doc.replicache.dev/concepts/how-it-works#speculative-execution-and-confirmation
        await convex.mutation('processMutation')({clientID: push.clientID, spaceID: defaultSpaceID, mutation, error: e.toString()})
      }

      console.log('Processed mutation in', Date.now() - t1);
    }

    res.send('{}');

    // We need to await here otherwise, Next.js will frequently kill the request
    // and the poke won't get sent.
    await sendPoke();
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e.toString());
  } finally {
    console.log('Processed push in', Date.now() - t0);
  }
}


async function sendPoke() {
    const pusher = new Pusher({
        appId: process.env.NEXT_PUBLIC_REPLICHAT_PUSHER_APP_ID!,
        key: process.env.NEXT_PUBLIC_REPLICHAT_PUSHER_KEY!,
        secret: process.env.REPLICHAT_PUSHER_SECRET!,
        cluster: process.env.NEXT_PUBLIC_REPLICHAT_PUSHER_CLUSTER!,
        useTLS: true,
      });
      const t0 = Date.now();
      await pusher.trigger('default', 'poke', {});
      console.log('Sent poke in', Date.now() - t0);
}