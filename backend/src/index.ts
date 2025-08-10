// index.ts
import { server as WebSocketServer, request as WebSocketRequest, connection as WebSocketConnection } from 'websocket';
import http from 'http';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import router from './router/routes';
import { handleClientRequest } from './wsServer';


export const clients: WebSocketConnection[] = [];

const app: Application = express();
export const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('✅ API is running');
});

app.use('/api', router);

handleClientRequest(httpServer);

httpServer.listen(3000, () => {
  console.log(`🚀 Server running on http://localhost:3000`);
});
