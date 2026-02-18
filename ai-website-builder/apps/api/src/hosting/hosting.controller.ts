import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HostingService } from './hosting.service';

@Controller('hosting')
export class HostingController {
  constructor(private hostingService: HostingService) {}

  @Get(':siteId/status')
  async getHostingStatus(
    @Param('siteId') siteId: string,
    @Query('domain') domain: string,
  ) {
    return this.hostingService.getHostingStatus(siteId, domain || 'localhost');
  }

  @Get('ssl/:domain')
  async getSSLStatus(@Param('domain') domain: string) {
    return this.hostingService.getSSLStatus(domain);
  }

  @Post('ssl/:domain/provision')
  async provisionSSL(@Param('domain') domain: string) {
    return this.hostingService.provisionSSL(domain);
  }

  @Get(':siteId/storage')
  async getStorageStatus(@Param('siteId') siteId: string) {
    return this.hostingService.getStorageStatus(siteId);
  }

  @Get('uptime/:domain')
  async getUptimeStatus(@Param('domain') domain: string) {
    return this.hostingService.getUptimeStatus(domain);
  }

  @Get(':siteId/backups')
  async getBackupInfo(@Param('siteId') siteId: string) {
    return this.hostingService.getBackupInfo(siteId);
  }

  @Post(':siteId/backups')
  async createBackup(
    @Param('siteId') siteId: string,
    @Body() body: { type?: 'full' | 'database' | 'files' },
  ) {
    return this.hostingService.createBackup(siteId, body.type || 'full');
  }

  @Post(':siteId/backups/:backupId/restore')
  async restoreBackup(
    @Param('siteId') siteId: string,
    @Param('backupId') backupId: string,
  ) {
    return this.hostingService.restoreBackup(siteId, backupId);
  }

  @Get('domain/:domain')
  async getDomainInfo(@Param('domain') domain: string) {
    return this.hostingService.getDomainInfo(domain);
  }

  @Post(':siteId/domain/connect')
  async connectDomain(
    @Param('siteId') siteId: string,
    @Body() body: { domain: string },
  ) {
    return this.hostingService.connectDomain(siteId, body.domain);
  }

  @Post(':siteId/update')
  async updateWordPress(
    @Param('siteId') siteId: string,
    @Body() body: { wpSiteUrl: string },
  ) {
    return this.hostingService.updateWordPress(siteId, body.wpSiteUrl);
  }
}
