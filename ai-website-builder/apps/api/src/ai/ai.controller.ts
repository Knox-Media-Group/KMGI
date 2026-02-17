import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AiService, CopilotMessage, CopilotContext, CopilotResponse } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../auth/auth.types';

class CopilotChatDto {
  messages: CopilotMessage[];
  context: CopilotContext;
}

class CopilotSuggestDto {
  context: CopilotContext;
}

class CopilotRewriteDto {
  text: string;
  style: 'professional' | 'casual' | 'persuasive' | 'concise';
  context: CopilotContext;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  /**
   * POST /api/ai/copilot/chat
   *
   * AI Co-Pilot chat endpoint for real-time editing assistance
   *
   * Request:
   * {
   *   "messages": [
   *     { "role": "user", "content": "Make my headline more compelling" }
   *   ],
   *   "context": {
   *     "siteSettings": { ... },
   *     "currentPage": { ... },
   *     "selectedSection": { ... } // optional
   *   }
   * }
   *
   * Response:
   * {
   *   "message": "Here's a more compelling headline...",
   *   "actions": [
   *     {
   *       "type": "update_text",
   *       "target": { "sectionId": "...", "blockId": "..." },
   *       "payload": { "content": "New headline text" }
   *     }
   *   ],
   *   "suggestions": ["Try adding a subheadline", "Consider using action words"]
   * }
   */
  @Post('copilot/chat')
  async copilotChat(
    @Req() req: AuthRequest,
    @Body() dto: CopilotChatDto,
  ): Promise<CopilotResponse> {
    return this.aiService.copilotChat(dto.messages, dto.context);
  }

  /**
   * POST /api/ai/copilot/suggest
   *
   * Get AI-powered improvement suggestions for the current page
   *
   * Request:
   * {
   *   "context": {
   *     "siteSettings": { ... },
   *     "currentPage": { ... }
   *   }
   * }
   *
   * Response:
   * {
   *   "message": "Here are some ways to improve your page...",
   *   "suggestions": ["Add testimonials", "Include a FAQ section", ...]
   * }
   */
  @Post('copilot/suggest')
  async copilotSuggest(
    @Req() req: AuthRequest,
    @Body() dto: CopilotSuggestDto,
  ): Promise<CopilotResponse> {
    return this.aiService.copilotSuggestImprovements(dto.context);
  }

  /**
   * POST /api/ai/copilot/rewrite
   *
   * Rewrite text in different styles
   *
   * Request:
   * {
   *   "text": "Welcome to our business",
   *   "style": "professional" | "casual" | "persuasive" | "concise",
   *   "context": { ... }
   * }
   *
   * Response:
   * {
   *   "original": "Welcome to our business",
   *   "rewritten": "Experience Excellence with Our Premier Services",
   *   "alternatives": ["Alternative 1", "Alternative 2"]
   * }
   */
  @Post('copilot/rewrite')
  async copilotRewrite(
    @Req() req: AuthRequest,
    @Body() dto: CopilotRewriteDto,
  ): Promise<{ original: string; rewritten: string; alternatives: string[] }> {
    return this.aiService.copilotRewriteText(dto.text, dto.style, dto.context);
  }
}
