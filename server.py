import asyncio
import websockets
import json
import logging
import signal
import socket
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

# Change logging level to only show errors
logging.basicConfig(level=logging.ERROR)  # Changed from DEBUG to ERROR
logger = logging.getLogger('websockets')
logger.setLevel(logging.ERROR)  # Changed from DEBUG to ERROR

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('', port))
            return False
        except socket.error:
            return True

def kill_process_on_port(port):
    if sys.platform.startswith('win'):
        try:
            os.system(f'netstat -ano | findstr :{port} > temp.txt')
            with open('temp.txt') as f:
                for line in f:
                    if f':{port}' in line:
                        pid = line.strip().split()[-1]
                        os.system(f'taskkill /F /PID {pid}')
            if os.path.exists('temp.txt'):
                os.remove('temp.txt')
        except Exception as e:
            print(f"Error killing process on port {port}: {e}")
    else:
        try:
            os.system(f'lsof -ti:{port} | xargs kill -9')
        except Exception as e:
            print(f"Error killing process on port {port}: {e}")

# Check and kill existing processes
if is_port_in_use(8000):
    print("Port 8000 in use, attempting to free it...")
    kill_process_on_port(8000)

if is_port_in_use(8765):
    print("Port 8765 in use, attempting to free it...")
    kill_process_on_port(8765)

# Global variable to store reference to HTTP server
httpd = None

def run_http_server():
    global httpd
    httpd = HTTPServer(('0.0.0.0', 8000), SimpleHTTPRequestHandler)
    print("HTTP server is running on http://0.0.0.0:8000")
    httpd.serve_forever()

clients = {}  # Change to dict to store client ID mapping
shared_map = None
shared_powerups = []
shared_monsters = []
first_client = None

def safe_send(ws, message):
    try:
        return ws.send(message)
    except websockets.ConnectionClosed:
        # Log the error if needed
        return None

async def handler(websocket):
    global shared_map, shared_powerups, shared_monsters, first_client
    client_id = None
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            if data.get("type") == "join":
                client_id = data["playerId"]
                clients[client_id] = websocket
                print(f"Client {client_id} joined. Total clients: {len(clients)}")
                print(f"Current shared_map status: {'Exists' if shared_map else 'None'}")
                
                if not first_client:
                    first_client = client_id
                    print(f"Requesting map from first client {client_id}")
                    await websocket.send(json.dumps({
                        "type": "request_map"
                    }))
                elif shared_map:
                    print(f"Sending existing map to client {client_id}")
                    print(f"Map data size: {len(str(shared_map))}")
                    await websocket.send(json.dumps({
                        "type": "init",
                        "map": shared_map,
                        "powerups": shared_powerups,
                        "monsters": shared_monsters
                    }))
            
            elif data.get("type") == "init":
                print(f"Received init data from client {client_id}")
                print(f"Received map data size: {len(str(data['map']))}")
                if not shared_map:  # Only accept init data if we don't have a map
                    print("Setting shared map")
                    shared_map = data["map"]
                    shared_powerups = data.get("powerups", [])
                    shared_monsters = data.get("monsters", [])
                    
                    # Broadcast map to all other clients
                    for cid, ws in list(clients.items()):
                        if cid != client_id:
                            asyncio.create_task(safe_send(ws, json.dumps({
                                "type": "init",
                                "map": shared_map,
                                "powerups": shared_powerups,
                                "monsters": shared_monsters
                            })))
            
            elif data.get("type") == "restart":
                print(f"Client {client_id} requested restart.")
                await websocket.close()
                return
            
            elif data.get("type") == "powerup_update":
                # Immediately update shared state and broadcast to all clients
                shared_powerups = data["powerups"]
                for cid, ws in clients.items():
                    if cid != client_id:  # Send to everyone except sender
                        await ws.send(json.dumps({
                            "type": "powerup_update",
                            "powerups": shared_powerups
                        }))
            
            else:
                # Regular game updates
                if client_id:
                    for cid, ws in clients.items():
                        if cid != client_id:
                            await ws.send(json.dumps(data))
                    
                    # Update shared state
                    if "monsters" in data:
                        shared_monsters = data["monsters"]
                    if "powerups" in data:
                        shared_powerups = data["powerups"]
                
    except websockets.ConnectionClosed:
        print(f"Client {client_id} disconnected normally")
    except Exception as e:
        print(f"Error handling client {client_id}: {e}")
    finally:
        if client_id in clients:
            del clients[client_id]
            # Broadcast disconnect to all remaining clients
            for cid, ws in list(clients.items()):
                try:
                    await ws.send(json.dumps({
                        "type": "player_disconnect",
                        "playerId": client_id
                    }))
                except websockets.ConnectionClosed:
                    # If sending fails because the connection is closed, remove that client.
                    if cid in clients:
                        del clients[cid]
            if client_id == first_client:
                first_client = next(iter(clients)) if clients else None
            print(f"Client {client_id} removed. Total clients: {len(clients)}")
            # Comment out the reset below so the maze persists:
            # if len(clients) == 0:
            #     print("All clients disconnected, resetting shared state")
            #     shared_map = None
            #     shared_powerups = []
            #     shared_monsters = []

async def main():
    print("Starting WebSocket server...")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket server is running on ws://0.0.0.0:8765")
        
        # Start HTTP server in a separate thread
        print("Starting HTTP server...")
        http_thread = threading.Thread(target=run_http_server)
        http_thread.daemon = True
        http_thread.start()
        
        await asyncio.Future()  # run forever

def signal_handler(sig, frame):
    print("\nShutting down servers...")
    # Stop the HTTP server
    if httpd:
        httpd.shutdown()
    # Stop the WebSocket server by stopping the event loop
    asyncio.get_event_loop().stop()
    print("Servers stopped")
    exit(0)

signal.signal(signal.SIGINT, signal_handler)

if __name__ == "__main__":
    print("Initializing servers...")
    asyncio.run(main()) 