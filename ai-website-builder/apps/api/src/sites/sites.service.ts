import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { BillingService } from '../billing/billing.service';
import { CreateSiteDto, SaveDraftDto, RollbackDto } from './sites.dto';
import { JobType, SiteStatus } from '../common/enums';
import { SiteContent, SiteSettings, Page } from '@builder/shared';

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
    private billingService: BillingService,
  ) {}

  async createSite(userId: string, tenantId: string, dto: CreateSiteDto) {
    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required to create a site');
    }

    // Create site
    const site = await this.prisma.site.create({
      data: {
        tenantId,
        ownerUserId: userId,
        name: dto.settings.businessName,
        status: SiteStatus.provisioning,
      },
    });

    // Create initial version with settings
    const initialContent: SiteContent = {
      pages: [],
      settings: dto.settings as unknown as SiteSettings,
    };

    await this.prisma.siteVersion.create({
      data: {
        siteId: site.id,
        versionNumber: 0,
        pageJson: initialContent as object,
      },
    });

    // Start provision job
    const job = await this.jobsService.createJob(site.id, JobType.provision, {
      settings: dto.settings,
    });

    return {
      site,
      jobId: job.id,
    };
  }

  async getSite(siteId: string, userId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (site.ownerUserId !== userId) {
      throw new ForbiddenException('Not authorized to access this site');
    }

    // Get current version
    const currentVersion = site.currentVersionId
      ? await this.prisma.siteVersion.findUnique({
          where: { id: site.currentVersionId },
        })
      : null;

    // Get all versions
    const versions = await this.prisma.siteVersion.findMany({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    // Get active job
    const activeJob = await this.jobsService.getActiveJobForSite(siteId);

    return {
      site,
      currentVersion,
      versions,
      activeJob,
    };
  }

  async getUserSites(userId: string, tenantId: string) {
    return this.prisma.site.findMany({
      where: {
        ownerUserId: userId,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateContent(siteId: string, userId: string, sectionId?: string) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required');
    }

    // Get settings from latest version
    const latestVersion = await this.prisma.siteVersion.findFirst({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion) {
      throw new BadRequestException('No version found for site');
    }

    const content = latestVersion.pageJson as unknown as SiteContent;

    // Start generation job
    const job = await this.jobsService.createJob(site.id, JobType.generate, {
      settings: content.settings,
      sectionId,
    });

    return { jobId: job.id };
  }

  async saveDraft(siteId: string, userId: string, dto: SaveDraftDto) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Get current version for settings
    const currentVersion = await this.prisma.siteVersion.findFirst({
      where: { siteId },
      orderBy: { versionNumber: 'desc' },
    });

    if (!currentVersion) {
      throw new BadRequestException('No version found');
    }

    const existingContent = currentVersion.pageJson as unknown as SiteContent;

    // Create new version
    const newVersion = await this.prisma.siteVersion.create({
      data: {
        siteId,
        versionNumber: currentVersion.versionNumber + 1,
        pageJson: {
          pages: dto.pages,
          settings: existingContent.settings,
        } as object,
      },
    });

    // Update site
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        currentVersionId: newVersion.id,
        status: site.status === SiteStatus.published ? SiteStatus.draft : site.status,
      },
    });

    return { version: newVersion };
  }

  async publish(siteId: string, userId: string) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required to publish');
    }

    if (!site.currentVersionId) {
      throw new BadRequestException('No version to publish');
    }

    if (!site.wpSiteId) {
      throw new BadRequestException('WordPress site not provisioned');
    }

    // Start publish job
    const job = await this.jobsService.createJob(site.id, JobType.publish, {
      versionId: site.currentVersionId,
    });

    return { jobId: job.id };
  }

  async rollback(siteId: string, userId: string, dto: RollbackDto) {
    const site = await this.getSiteOrThrow(siteId, userId);

    // Check subscription
    const hasActiveSubscription = await this.billingService.hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required');
    }

    // Verify version exists and belongs to this site
    const version = await this.prisma.siteVersion.findUnique({
      where: { id: dto.versionId },
    });

    if (!version || version.siteId !== siteId) {
      throw new NotFoundException('Version not found');
    }

    if (!site.wpSiteId) {
      throw new BadRequestException('WordPress site not provisioned');
    }

    // Start rollback job
    const job = await this.jobsService.createJob(site.id, JobType.rollback, {
      versionId: dto.versionId,
    });

    return { jobId: job.id };
  }

  private async getSiteOrThrow(siteId: string, userId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (site.ownerUserId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    return site;
  }
}
