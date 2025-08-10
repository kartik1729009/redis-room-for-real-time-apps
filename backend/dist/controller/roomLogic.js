"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.createRoomLogic = createRoomLogic;
exports.checkRoomExist = checkRoomExist;
exports.allRooms = allRooms;
exports.allRoomsId = allRoomsId;
exports.joinRoom = joinRoom;
exports.getAllParticipants = getAllParticipants;
exports.leaveRoom = leaveRoom;
exports.deleteRoom = deleteRoom;
const redisConnectivity_1 = __importDefault(require("../config/redisConnectivity"));
const uuid_1 = require("uuid");
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '50');
const BASE_URL = process.env.BASE_URL || 'https://domain.com';
function createRoom(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const userName = req.body;
        const roomId = (0, uuid_1.v4)();
        const roomUrl = `${BASE_URL}/room/${roomId}`;
        const room = {
            id: roomId,
            createdAt: Date.now(),
            createdBy: userName,
            participants: userName ? [userName] : [],
            settings: {
                maxParticipants: MAX_PARTICIPANTS,
                isLocked: false
            }
        };
        yield redisConnectivity_1.default.set(`room:${roomId}`, JSON.stringify(room), 'EX', 86400);
        return { roomId, roomUrl };
    });
}
function createRoomLogic(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { roomId, roomUrl } = yield createRoom(req);
            res.status(200).json({ roomId, roomUrl });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ error: "Room creation failed" });
        }
    });
}
function checkRoomExist(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { roomId } = req.params;
        const room = yield redisConnectivity_1.default.get(`room:${roomId}`);
        res.status(room ? 200 : 404).json(Object.assign({ exists: !!room, roomId }, (!room && { message: "Room not found" })));
    });
}
function allRooms() {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = yield redisConnectivity_1.default.keys('room:*');
        return keys.map(key => key.split(':')[1]);
    });
}
function allRoomsId(_req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        res.status(200).json({ roomId: yield allRooms() });
    });
}
function handleRoomJoin(roomId, userName) {
    return __awaiter(this, void 0, void 0, function* () {
        const multi = redisConnectivity_1.default.multi();
        multi.get(`room:${roomId}`);
        const execResult = yield multi.exec();
        if (!execResult)
            throw new Error("Transaction failed");
        const [error, roomData] = execResult[0];
        if (error)
            throw error;
        if (!roomData)
            throw new Error("Room not found");
        const room = JSON.parse(roomData);
        if (room.participants.length >= room.settings.maxParticipants) {
            throw new Error("Room full");
        }
        yield redisConnectivity_1.default.set(`room:${roomId}`, JSON.stringify(Object.assign(Object.assign({}, room), { participants: [...room.participants, userName] })));
    });
}
function joinRoom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roomId = req.params.roomId || req.body.roomId;
            const userName = req.body.userName;
            if (!roomId || !userName) {
                res.status(400).json({ success: false, message: "Missing parameters" });
                return;
            }
            yield handleRoomJoin(roomId, userName);
            res.status(200).json({ success: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Join failed";
            const status = message === "Room not found" ? 404 :
                message === "Room full" ? 403 : 500;
            res.status(status).json({ success: false, message });
        }
    });
}
function getAllParticipants(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { roomId } = req.params;
        const data = yield redisConnectivity_1.default.get(`room:${roomId}`);
        res.status(data ? 200 : 404).json(Object.assign({ success: !!data }, (data ? { participants: JSON.parse(data).participants } : { message: "Room not found" })));
    });
}
function leaveRoom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { roomId } = req.params;
            const { userName } = req.body;
            if (!userName || !roomId) {
                res.status(400).json({ success: false, message: "Missing parameters" });
                return;
            }
            const multi = redisConnectivity_1.default.multi();
            multi.get(`room:${roomId}`);
            const execResult = yield multi.exec();
            if (!execResult)
                throw new Error("Transaction failed");
            const [error, roomData] = execResult[0];
            if (error)
                throw error;
            if (!roomData)
                throw new Error("Room not found");
            const room = JSON.parse(roomData);
            if (!room.participants.includes(userName)) {
                res.status(400).json({ success: false, message: "User not in room" });
                return;
            }
            yield redisConnectivity_1.default.set(`room:${roomId}`, JSON.stringify(Object.assign(Object.assign({}, room), { participants: room.participants.filter(u => u !== userName) })));
            res.status(200).json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, message: "Internal error" });
        }
    });
}
function deleteRoom(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { roomId } = req.params;
        const exists = yield redisConnectivity_1.default.exists(`room:${roomId}`);
        if (!exists) {
            res.status(404).json({ success: false, message: "Room not found" });
        }
        yield redisConnectivity_1.default.del(`room:${roomId}`);
        res.status(200).json({ success: true });
    });
}
