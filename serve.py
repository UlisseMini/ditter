from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosedError
from typing import List
import asyncio
import json

app = FastAPI()

# TODO: Convert to starlette (better websocket handling)

# tasks to send new messages to
msg_subscriptions: List[asyncio.Queue] = []

invites = {
  'EleutherAI': 'https://discord.gg/zBGx3azzUn',
  'Mathematics': 'https://discord.com/invite/math',
  'PenSquid': 'https://discord.gg/A2uE8rksqy',
}


tail_proc: asyncio.subprocess.Process


async def read_tail():
    assert tail_proc.stdout
    async for line in tail_proc.stdout:
        d = json.loads(line)
        for subscriber in msg_subscriptions:
            try:
                subscriber.put_nowait(d)
            except asyncio.QueueFull:
                # design decision: if client can't keep up, drop packets
                pass



@app.on_event('startup')
async def startup():
    global tail_proc
    tail_proc = await asyncio.subprocess.create_subprocess_shell(
        'tail -f ./messages.json',
        stdout=asyncio.subprocess.PIPE,
    )
    asyncio.create_task(read_tail())


@app.on_event('shutdown')
async def shutdown():
    if tail_proc.returncode is None:
        tail_proc.terminate()
    await tail_proc.wait()


@app.websocket('/subscribe')
async def subscribe(websocket: WebSocket):
    await websocket.accept()
    queue = asyncio.Queue(maxsize=16)
    msg_subscriptions.append(queue)
    print(f'added subscriber, currently {len(msg_subscriptions)} subscribers')
    try:
        while True:
            item = await queue.get()
            await websocket.send_text(json.dumps(item))
    except (WebSocketDisconnect, ConnectionClosedError) as e:
        print(e)
    finally:
        msg_subscriptions.remove(queue)
        print(f'removed subscriber, currently {len(msg_subscriptions)} subscribers')


@app.get('/invites')
async def get_invites():
    return invites

app.mount('/', StaticFiles(directory='public', html=True), '')

