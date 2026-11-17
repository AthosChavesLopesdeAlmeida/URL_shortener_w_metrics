import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LinksRepository } from './links.repository.js';
import { generateShortCode } from './short-code.js';

@Injectable()
export class QrService {
  constructor(
    private readonly links: LinksRepository,
    ) {}
}
