"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StatusGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let StatusGateway = StatusGateway_1 = class StatusGateway {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(StatusGateway_1.name);
    }
    async afterInit() {
        this.logger.log('WebSocket Gateway initialized');
        await this.setupPgListen();
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client?.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client?.id}`);
    }
    handleJoin(client, data) {
        if (data.country) {
            client.join(`country:${data.country}`);
            this.logger.log(`Client ${client.id} joined room: country:${data.country}`);
            return { event: 'joined', data: `Joined country:${data.country}` };
        }
    }
    async setupPgListen() {
        try {
            const client = await this.db.getClient();
            await client.query('LISTEN status_channel');
            client.on('notification', (msg) => {
                if (msg.channel === 'status_channel') {
                    const payload = JSON.parse(msg.payload);
                    this.logger.log(`Received pg_notify on status_channel: ${JSON.stringify(payload)}`);
                    if (payload.country && this.server) {
                        this.server.to(`country:${payload.country}`).emit('status:changed', payload);
                    }
                }
            });
            this.logger.log('Listening to pg_notify "status_channel"');
        }
        catch (e) {
            this.logger.error('Failed to setup pg_notify listener', e);
        }
    }
};
exports.StatusGateway = StatusGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Object)
], StatusGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StatusGateway.prototype, "handleJoin", null);
exports.StatusGateway = StatusGateway = StatusGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], StatusGateway);
//# sourceMappingURL=status.gateway.js.map