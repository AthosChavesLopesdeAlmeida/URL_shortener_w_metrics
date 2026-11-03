import { Module } from "@nestjs/common";
import { LinksRepository } from "./links.repository.js";
import { LinksService } from "./links.service.js";
import { AuthService } from "../auth/auth.service.js";

@Module({
    exports: [LinksRepository],
    imports: [AuthService],
    controllers: [],
    providers: [LinksRepository, LinksService],

})
export class LinksModule {}