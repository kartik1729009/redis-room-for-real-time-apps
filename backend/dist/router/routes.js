"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const roomLogic_1 = require("../controller/roomLogic");
const roomLogic_2 = require("../controller/roomLogic");
const roomLogic_3 = require("../controller/roomLogic");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.post("/createroom", roomLogic_1.createRoomLogic);
router.get("/roomexist/:roomId", roomLogic_2.checkRoomExist);
router.get("/allroomid", roomLogic_3.allRoomsId);
router.post('/joinroom/:roomId', roomLogic_3.joinRoom);
router.get('/participants/:roomId', roomLogic_3.getAllParticipants);
router.post('/leaveroom/:roomId', roomLogic_3.leaveRoom);
router.delete('/deleteroom/:roomId', roomLogic_3.deleteRoom);
exports.default = router;
