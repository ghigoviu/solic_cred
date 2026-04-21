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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditRequestController = void 0;
const common_1 = require("@nestjs/common");
const credit_request_service_1 = require("./credit-request.service");
const create_request_dto_1 = require("./dto/create-request.dto");
const swagger_1 = require("@nestjs/swagger");
let CreditRequestController = class CreditRequestController {
    constructor(service) {
        this.service = service;
    }
    async create(dto) {
        const requestId = await this.service.create(dto);
        return { requestId, status: 'VALIDATING' };
    }
    async findAll(country) {
        return this.service.findAll(country);
    }
    async findOne(id) {
        const req = await this.service.findOne(id);
        if (!req)
            throw new common_1.NotFoundException('Request not found');
        return req;
    }
    async updateStatus(id, status) {
        const success = await this.service.updateStatus(id, status);
        if (!success)
            throw new common_1.NotFoundException('Request not found');
        return { id, status };
    }
};
exports.CreditRequestController = CreditRequestController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_request_dto_1.CreateRequestDto]),
    __metadata("design:returntype", Promise)
], CreditRequestController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('country')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CreditRequestController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CreditRequestController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CreditRequestController.prototype, "updateStatus", null);
exports.CreditRequestController = CreditRequestController = __decorate([
    (0, swagger_1.ApiTags)('requests'),
    (0, common_1.Controller)('requests'),
    __metadata("design:paramtypes", [credit_request_service_1.CreditRequestService])
], CreditRequestController);
//# sourceMappingURL=credit-request.controller.js.map