import { Module } from '@nestjs/common';
import { AgentTokenController } from './agent-token.controller';
import { AgentTokenRepository } from './agent-token.repository';
import { AgentTokenService } from './agent-token.service';
import { AgentTokenStrategy } from './strategies/agent-token.strategy';

@Module({
  controllers: [AgentTokenController],
  providers: [AgentTokenRepository, AgentTokenService, AgentTokenStrategy],
  exports: [AgentTokenRepository],
})
export class AgentTokenModule {}
