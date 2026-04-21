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
var DatabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let DatabaseService = DatabaseService_1 = class DatabaseService {
    constructor() {
        this.logger = new common_1.Logger(DatabaseService_1.name);
        this.pool = new pg_1.Pool({
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            user: process.env.DB_USER || 'credituser',
            password: process.env.DB_PASSWORD || 'SuperSecret',
            database: process.env.DB_NAME || 'credit',
            max: 20,
        });
    }
    async onModuleInit() {
        try {
            await this.pool.query('SELECT 1');
            this.logger.log('Connected to PostgreSQL successfully');
        }
        catch (error) {
            this.logger.error('Failed to connect to DB on module init', error);
        }
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
    async query(queryText, values) {
        const res = await this.pool.query(queryText, values);
        return res.rows;
    }
    async getClient() {
        const client = await this.pool.connect();
        return client;
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
//# sourceMappingURL=database.service.js.map