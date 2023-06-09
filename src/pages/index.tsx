import React, {useRef} from 'react';
import {Replicache, TEST_LICENSE_KEY} from 'replicache';
import {useSubscribe} from 'replicache-react';
import {nanoid} from 'nanoid';
import Pusher from 'pusher-js';

const rep = process.browser
  ? new Replicache({
      name: 'chat-user-id',
      licenseKey: TEST_LICENSE_KEY,
      pushURL: '/api/replicache-push',
      pullURL: '/api/replicache-pull',
      mutators: {
        async createMessage(tx: any, {id, from, content, order}: any) {
          await tx.put(`message/${id}`, {
            from,
            content,
            order,
          });
        },
      }
    })
  : null;

if (rep) {
  listen(rep);
}

export default function Home() {
  return <Chat rep={rep!} />;
}

function Chat({rep}: {rep: Replicache<any>}) {
  const messages = useSubscribe(
    rep,
    async tx => {
      const list = await tx.scan({prefix: 'message/'}).entries().toArray() as any;
      list.sort(([, {order: a}]: any, [, {order: b}]: any) => a - b);
      return list;
    },
    [],
  );

  const usernameRef = useRef() as any;
  const contentRef = useRef() as any;

  const onSubmit = (e: any) => {
    e.preventDefault();
    const last = messages.length && messages[messages.length - 1][1];
    const order = (last?.order ?? 0) + 1;
    rep.mutate.createMessage({
      id: nanoid(),
      from: usernameRef.current!.value,
      content: contentRef.current!.value,
      order,
    });
    contentRef.current.value = '';
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={onSubmit}>
        <input ref={usernameRef} style={styles.username} required />
        says:
        <input ref={contentRef} style={styles.content} required />
        <input type="submit" />
      </form>
      <MessageList messages={messages} />
    </div>
  );
}

function MessageList({messages}: any) {
  return messages.map(([k, v]: any) => {
    return (
      <div key={k}>
        <b>{v.from}: </b>
        {v.content}
      </div>
    );
  });
}

const styles: any = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  form: {
    display: 'flex',
    flexDirection: 'row',
    flex: 0,
    marginBottom: '1em',
  },
  username: {
    flex: 0,
    marginRight: '1em',
  },
  content: {
    flex: 1,
    maxWidth: '30em',
    margin: '0 1em',
  },
};

function listen(rep: Replicache<any>) {
  console.log('listening');
  // Listen for pokes, and pull whenever we get one.
  Pusher.logToConsole = true;
  const pusher = new Pusher(process.env.NEXT_PUBLIC_REPLICHAT_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_REPLICHAT_PUSHER_CLUSTER!,
  });
  const channel = pusher.subscribe('default');
  channel.bind('poke', () => {
    console.log('got poked');
    rep.pull();
  });
}