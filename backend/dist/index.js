"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.clients = void 0;
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./router/routes"));
const wsServer_1 = require("./wsServer");
exports.clients = [];
const app = (0, express_1.default)();
exports.httpServer = http_1.default.createServer(app);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (_req, res) => {
    res.send('✅ API is running');
});
app.use('/api', routes_1.default);
(0, wsServer_1.handleClientRequest)(exports.httpServer);
exports.httpServer.listen(3000, () => {
    console.log(`🚀 Server running on http://localhost:3000`);
});
