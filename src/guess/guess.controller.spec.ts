import { Test, TestingModule } from '@nestjs/testing';
import { GuessController } from './guess.controller';

describe('GuessController', () => {
  let controller: GuessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuessController],
    }).compile();

    controller = module.get<GuessController>(GuessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
