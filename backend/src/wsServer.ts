import {
  server as WebSocketServer,
  request as WebSocketRequest,
  connection as WebSocketConnection,
} from 'websocket';
import redis from './config/redisConnectivity';
import { Server } from 'http';
import { sendMessage } from './controller/chatLogic';

interface RoomConnection extends WebSocketConnection {
  userName?: string;
  roomId?: string;
}

const activeRoomConnections = new Map<string, Set<RoomConnection>>();

function originIsAllowed(origin: string): boolean {
  return true;
}

export function handleClientRequest(httpServer: Server) {
  const wsServer = new WebSocketServer({
    httpServer,
    autoAcceptConnections: false,
  });

  wsServer.on('request', (request: WebSocketRequest) => {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      console.log(`${new Date()} ❌ Rejected connection from ${request.origin}`);
      return;
    }

    const connection = request.accept(null, request.origin) as RoomConnection;
    console.log(`${new Date()} ✅ Connection accepted from ${request.origin}`);

    connection.on('message', async(message) => {
      if (message.type === 'utf8' && message.utf8Data) {
        try {
          const data = JSON.parse(message.utf8Data);
          const { type, roomId, userName, text } = data;

          if (!type) {
            console.error('Missing message type');
            return;
          }

          if (type === 'join') {
            if (!roomId || !userName) {
              console.error('Join message missing roomId or userName');
              return;
            }

            connection.roomId = roomId;
            connection.userName = userName;

            const redisRoom = await redis.get(`room:${roomId}`);
            if (!redisRoom) {
              const errorMsg = {
                type: 'utf8',
                utf8Data: JSON.stringify({
                  type: 'error',
                  message: `Room "${roomId}" does not exist.`,
                }),
              };
              sendMessage(errorMsg, connection);
              connection.close(); // close the socket politely
              return;
            }

            if (!activeRoomConnections.has(roomId)) {
              activeRoomConnections.set(roomId, new Set());
            }

            const roomConnections = activeRoomConnections.get(roomId)!;
            roomConnections.add(connection);

            const joinNotification = {
              type: 'utf8',
              utf8Data: JSON.stringify({
                type: 'notification',
                message: `${userName} joined the room.`,
                timestamp: new Date().toISOString()
              }),
            };

            // Send to ALL connected clients including the sender
            roomConnections.forEach((client) => {
              if (client.connected) {
                sendMessage(joinNotification, client);
              }
            });

          } else if (type === 'message') {
            if (!connection.roomId || !connection.userName) {
              console.error('Message from unregistered connection');
              return;
            }

            const messagePacket = {
              type: 'utf8',
              utf8Data: JSON.stringify({
                type: 'message',
                userName: connection.userName,
                text,
                timestamp: new Date().toISOString()
              }),
            };

            activeRoomConnections.get(connection.roomId)?.forEach((client) => {
              if (client.connected) {
                sendMessage(messagePacket, client);
              }
            });
          }
        } catch (err) {
          console.error('❌ Error processing message:', err);
        }
      } else if (message.type === 'binary') {
        if (!connection.roomId) {
          console.error('Binary message from connection without roomId');
          return;
        }

        activeRoomConnections.get(connection.roomId)?.forEach((client) => {
          if (client.connected) {
            sendMessage(message, client);
          }
        });
      }
    });

    connection.on('close', (reasonCode, description) => {
      const { roomId, userName } = connection;
      console.log(`❌ Connection closed. Code: ${reasonCode}, Description: ${description}`);

      if (roomId && userName && activeRoomConnections.has(roomId)) {
        const roomConnections = activeRoomConnections.get(roomId)!;
        roomConnections.delete(connection);

        const leaveNotification = {
          type: 'utf8',
          utf8Data: JSON.stringify({
            type: 'notification',
            message: `${userName} left the room.`,
            timestamp: new Date().toISOString()
          }),
        };

        roomConnections.forEach((client) => {
          if (client.connected) {
            sendMessage(leaveNotification, client);
          }
        });

        if (roomConnections.size === 0) {
          activeRoomConnections.delete(roomId);
        }
      }
    });

    connection.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}