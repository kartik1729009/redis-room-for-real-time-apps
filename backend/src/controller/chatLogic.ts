import { connection as WebSocketConnection } from 'websocket';

export function sendMessage(data: any, connection: WebSocketConnection) {
  try {
    if (data.type === 'utf8' && data.utf8Data) {
      connection.sendUTF(data.utf8Data);
    } else if (data.type === 'binary') {
      if (data.binaryData) {
        connection.sendBytes(data.binaryData);
      } else {
        connection.sendBytes(data);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}