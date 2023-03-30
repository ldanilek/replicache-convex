import { DatabaseReader, DatabaseWriter, mutation } from "./_generated/server";

type MutationArg = { clientID: string; spaceID: string, mutation: any, error?: string };

export default mutation(async ({ db },
    { clientID, spaceID, mutation, error }: MutationArg,
) => {
  // Get the previous version for the affected space and calculate the next
  // one.
  const space = await db.query('space').withIndex('by_key', q => q.eq('key', spaceID)).unique();
  if (!space) {
    throw new Error(`no space with id ${spaceID}`);
  }
  const { version: prevVersion } = space;
  const nextVersion = prevVersion + 1;

  const lastMutationID = await getLastMutationID(db, clientID, false);
  const nextMutationID = lastMutationID + 1;

  console.log('nextVersion', nextVersion, 'nextMutationID', nextMutationID);

  // It's common due to connectivity issues for clients to send a
  // mutation which has already been processed. Skip these.
  if (mutation.id < nextMutationID) {
    console.log(
      `Mutation ${mutation.id} has already been processed - skipping`,
    );
    return;
  }

  // If the Replicache client is working correctly, this can never
  // happen. If it does there is nothing to do but return an error to
  // client and report a bug to Replicache.
  if (mutation.id > nextMutationID) {
    throw new Error(`Mutation ${mutation.id} is from the future - aborting`);
  }

  if (error === undefined) {
    console.log('Processing mutation:', JSON.stringify(mutation));

    // For each possible mutation, run the server-side logic to apply the
    // mutation.
    switch (mutation.name) {
      case 'createMessage':
        await createMessage(db, mutation.args, spaceID, nextVersion);
        break;
      default:
        throw new Error(`Unknown mutation: ${mutation.name}`);
    }
  } else {
    // TODO: You can store state here in the database to return to clients to
    // provide additional info about errors.
    console.log(
      'Handling error from mutation',
      JSON.stringify(mutation),
      error,
    );
  }

  console.log('setting', clientID, 'last_mutation_id to', nextMutationID);
  // Update lastMutationID for requesting client.
  await setLastMutationID(db, clientID, nextMutationID);

  // Update version for space.
  await db.patch(space._id, {version: nextVersion});
});

export async function getLastMutationID(db: DatabaseReader, clientID: string, required: boolean) {
  const clientRow = await db.query('replicache_client').withIndex('by_client_id', q => q.eq('id', clientID)).unique();
  if (!clientRow) {
    // If the client is unknown ensure the request is from a new client. If it
    // isn't, data has been deleted from the server, which isn't supported:
    // https://github.com/rocicorp/replicache/issues/1033.
    if (required) {
      throw new Error(`client not found: ${clientID}`);
    }
    return 0;
  }
  return clientRow.last_mutation_id;
}

async function setLastMutationID(db: DatabaseWriter, clientID: string, mutationID: number) {
  const clientRow = await db.query('replicache_client').withIndex('by_client_id', q => q.eq('id', clientID)).unique();
  if (clientRow) {
    await db.patch(clientRow._id, {last_mutation_id: mutationID});
  } else {
    await db.insert('replicache_client', {id: clientID, last_mutation_id: mutationID});
  }
}

async function createMessage(db: DatabaseWriter, {id, from, content, order}: {id: string, from: string, content: string, order: number}, spaceID: string, version: number) {
  await db.insert('message', {
    id,
    space_id: spaceID,
    sender: from,
    content,
    ord: order,
    version,
    deleted: false,
  });
}