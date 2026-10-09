import { Controller, INestApplication, Logger, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { GlobalExceptionFilter } from './global-exception.filter';

@Controller('body')
class BodyController {
  @Post()
  accept(): { accepted: boolean } {
    return { accepted: true };
  }
}

describe('GlobalExceptionFilter through the real JSON body parser', () => {
  it('rejects a malformed body without logging its password or address', async () => {
    const module = await Test.createTestingModule({
      controllers: [BodyController],
    }).compile();
    const app = module.createNestApplication<INestApplication<Server>>();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    app.useGlobalFilters(new GlobalExceptionFilter());
    try {
      await app.listen(0, '127.0.0.1');
      const response = await request(app.getHttpServer())
        .post('/body')
        .set('Content-Type', 'application/json')
        .send('{"email":"secret@example.com","password":hunter2}');

      expect(response.statusCode).toBe(400);
      const logged = warn.mock.calls.flat().join(' ');
      expect(logged).toContain('HttpException (400): INVALID_INPUT');
      expect(logged).not.toContain('secret@example.com');
      expect(logged).not.toContain('hunter2');
    } finally {
      warn.mockRestore();
      await app.close();
    }
  });
});
