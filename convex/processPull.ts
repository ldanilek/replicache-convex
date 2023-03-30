import { getLastMutationID } from "./processMutation";
import { query } from "./_generated/server";

const defaultSpaceID = 'default';

export default query(async ({ db }, { pull }: {pull: any}) => {
  // Get current version for space.
  const version = (await db.query('space').withIndex('by_key', q => q.eq('key', defaultSpaceID)).unique())!.version;

  // Get lmid for requesting client.
  const isExistingClient = pull.lastMutationID > 0;
  const lastMutationID = await getLastMutationID(
    db,
    pull.clientID,
    isExistingClient,
  );

  // Get changed domain objects since requested version.
  const fromVersion = pull.cookie ?? 0;

  const changed = await db.query('message').withIndex('by_version', q => q.gt('version', fromVersion)).collect();

  // Build and return response.
  const patch = [];
  for (const row of changed) {
    if (row.deleted) {
      if (fromVersion > 0) {
        patch.push({
          op: 'del',
          key: `message/${row.id}`,
        });
      }
    } else {
      patch.push({
        op: 'put',
        key: `message/${row.id}`,
        value: {
          from: row.sender,
          content: row.content,
          order: row.ord,
        },
      });
    }
  }

  return {
    lastMutationID,
    cookie: version,
    patch,
  };
});
