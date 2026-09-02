import asyncio
import json
import websockets

async def test():
    ws = await websockets.connect("ws://127.0.0.1:8000/ws")

    await ws.send(json.dumps({
        "type": "text",
        "text": "Hello Neeraj, explain what you can do in one short sentence."
    }))

    for _ in range(10):
        message = await ws.recv()
        data = json.loads(message)

        print("TYPE:", data.get("type"))

        if data.get("type") == "message":
            print("ANSWER:", data.get("content"))

        elif data.get("type") == "audio":
            print("AUDIO RECEIVED:", len(data.get("audio", "")), "base64 characters")

        elif data.get("type") == "done":
            print("DONE")
            break

    await ws.close()

asyncio.run(test())
