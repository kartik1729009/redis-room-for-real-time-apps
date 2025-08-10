"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleClientRequest = handleClientRequest;
const websocket_1 = require("websocket");
const chatLogic_1 = require("./controller/chatLogic");
const activeRoomConnections = new Map();
function originIsAllowed(origin) {
    return true; // Allow all origins (adjust for production)
}
function handleClientRequest(httpServer) {
    const wsServer = new websocket_1.server({
        httpServer,
        autoAcceptConnections: false,
    });
    wsServer.on('request', (request) => {
        if (!originIsAllowed(request.origin)) {
            request.reject();
            console.log(`${new Date()} ❌ Rejected connection from ${request.origin}`);
            return;
        }
        const connection = request.accept(null, request.origin);
        console.log(`${new Date()} ✅ Connection accepted from ${request.origin}`);
        connection.on('message', (message) => {
            var _a, _b;
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
                        if (!activeRoomConnections.has(roomId)) {
                            activeRoomConnections.set(roomId, new Set());
                        }
                        const roomConnections = activeRoomConnections.get(roomId);
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
                                (0, chatLogic_1.sendMessage)(joinNotification, client);
                            }
                        });
                    }
                    else if (type === 'message') {
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
                        (_a = activeRoomConnections.get(connection.roomId)) === null || _a === void 0 ? void 0 : _a.forEach((client) => {
                            if (client.connected) {
                                (0, chatLogic_1.sendMessage)(messagePacket, client);
                            }
                        });
                    }
                }
                catch (err) {
                    console.error('❌ Error processing message:', err);
                }
            }
            else if (message.type === 'binary') {
                if (!connection.roomId) {
                    console.error('Binary message from connection without roomId');
                    return;
                }
                (_b = activeRoomConnections.get(connection.roomId)) === null || _b === void 0 ? void 0 : _b.forEach((client) => {
                    if (client.connected) {
                        (0, chatLogic_1.sendMessage)(message, client);
                    }
                });
            }
        });
        connection.on('close', (reasonCode, description) => {
            const { roomId, userName } = connection;
            console.log(`❌ Connection closed. Code: ${reasonCode}, Description: ${description}`);
            if (roomId && userName && activeRoomConnections.has(roomId)) {
                const roomConnections = activeRoomConnections.get(roomId);
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
                        (0, chatLogic_1.sendMessage)(leaveNotification, client);
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
