"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const credit_request_module_1 = require("./credit-request/credit-request.module");
const rules_module_1 = require("./rules/rules.module");
const workers_module_1 = require("./workers/workers.module");
const gateway_module_1 = require("./gateway/gateway.module");
const database_module_1 = require("./database/database.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            credit_request_module_1.CreditRequestModule,
            rules_module_1.RulesModule,
            workers_module_1.WorkersModule,
            gateway_module_1.GatewayModule
        ]
    })
], AppModule);
//# sourceMappingURL=app.module.js.map