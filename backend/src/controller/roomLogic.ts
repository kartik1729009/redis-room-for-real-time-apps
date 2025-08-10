import redis from '../config/redisConnectivity';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';


const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '50');
const BASE_URL = process.env.BASE_URL || 'https://domain.com';

interface RoomData {
  id: string;
  createdAt: number;
  createdBy?: string;
  participants: string[];
  settings: {
    maxParticipants: number;
    isLocked: boolean;
  };
}

export async function createRoom(req: Request): Promise<{ roomId: string; roomUrl: string }> {
  const userName = req.body;
  const roomId = uuidv4();
  const roomUrl = `${BASE_URL}/room/${roomId}`;
  const room: RoomData = {
    id: roomId,
    createdAt: Date.now(),
    createdBy: userName,
    participants: userName ? [userName] : [],
    settings: {
      maxParticipants: MAX_PARTICIPANTS,
      isLocked: false
    }
  };

  await redis.set(`room:${roomId}`, JSON.stringify(room), 'EX', 86400);
  return { roomId, roomUrl };
}

export async function createRoomLogic(req: Request, res: Response): Promise<void> {
  try {
    const { roomId, roomUrl } = await createRoom(req);
    res.status(200).json({ roomId, roomUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Room creation failed" });
  }
}

export async function checkRoomExist(req: Request, res: Response) {
  const { roomId } = req.params;
  const room = await redis.get(`room:${roomId}`);
  res.status(room ? 200 : 404).json({
    exists: !!room,
    roomId,
    ...(!room && { message: "Room not found" })
  });
}

export async function allRooms(): Promise<string[]> {
  const keys = await redis.keys('room:*');
  return keys.map(key => key.split(':')[1]);
}

export async function allRoomsId(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ roomId: await allRooms() });
}

async function handleRoomJoin(roomId: string, userName: string) {
  const multi = redis.multi();
  multi.get(`room:${roomId}`);
  const execResult = await multi.exec();
  
  if (!execResult) throw new Error("Transaction failed");
  const [error, roomData] = execResult[0];
  if (error) throw error;
  if (!roomData) throw new Error("Room not found");

  const room = JSON.parse(roomData as string) as RoomData;
  if (room.participants.length >= room.settings.maxParticipants) {
    throw new Error("Room full");
  }

  await redis.set(`room:${roomId}`, JSON.stringify({
    ...room,
    participants: [...room.participants, userName]
  }));
}

export async function joinRoom(req: Request, res: Response): Promise<void> {
  try {
    const roomId = req.params.roomId || req.body.roomId;
    const userName = req.body.userName;
    
    if (!roomId || !userName) {
      res.status(400).json({ success: false, message: "Missing parameters" });
      return;
    }

    await handleRoomJoin(roomId, userName);
    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Join failed";
    const status = message === "Room not found" ? 404 : 
                 message === "Room full" ? 403 : 500;
    res.status(status).json({ success: false, message });
  }
}

export async function getAllParticipants(req: Request, res: Response) {
  const { roomId } = req.params;
  const data = await redis.get(`room:${roomId}`);
  res.status(data ? 200 : 404).json({
    success: !!data,
    ...(data ? { participants: JSON.parse(data).participants } : { message: "Room not found" })
  });
}

export async function leaveRoom(req: Request, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const { userName } = req.body;
    
    if (!userName || !roomId) {
      res.status(400).json({ success: false, message: "Missing parameters" });
      return;
    }

    const multi = redis.multi();
    multi.get(`room:${roomId}`);
    const execResult = await multi.exec();
    
    if (!execResult) throw new Error("Transaction failed");
    const [error, roomData] = execResult[0];
    if (error) throw error;
    if (!roomData) throw new Error("Room not found");

    const room = JSON.parse(roomData as string) as RoomData;
    if (!room.participants.includes(userName)) {
      res.status(400).json({ success: false, message: "User not in room" });
      return;
    }

    await redis.set(`room:${roomId}`, JSON.stringify({
      ...room,
      participants: room.participants.filter(u => u !== userName)
    }));

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal error" });
  }
}

export async function deleteRoom(req: Request, res: Response): Promise<void> {
  const { roomId } = req.params;
  const exists = await redis.exists(`room:${roomId}`);
  if (!exists) {
    res.status(404).json({ success: false, message: "Room not found" });
  }
  await redis.del(`room:${roomId}`);
  res.status(200).json({ success: true });
}