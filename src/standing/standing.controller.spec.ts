import { Test, TestingModule } from '@nestjs/testing';
import { StandingController } from './standing.controller';

describe('StandingController', () => {
  let controller: StandingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandingController],
    }).compile();

    controller = module.get<StandingController>(StandingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
