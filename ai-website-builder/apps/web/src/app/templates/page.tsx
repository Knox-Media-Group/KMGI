'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, Star, Sparkles, Crown, Eye, Zap,
  Building2, ShoppingCart, Briefcase, FileText, Rocket, UtensilsCrossed,
  HeartPulse, Home, Dumbbell, Scissors, GraduationCap, Heart, X, Check,
  Laptop, ChevronDown, Grid3X3, LayoutList, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  WEBSITE_TEMPLATES,
  WebsiteTemplate,
  TemplateCategory,
  getPopularTemplates,
  getNewTemplates,
  searchTemplates,
} from '@builder/shared';

const CATEGORIES: { id: TemplateCategory | 'all'; label: string; icon: typeof Building2 }[] = [
  { id: 'all', label: 'All Templates', icon: Grid3X3 },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'landing', label: 'Landing Page', icon: Rocket },
  { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { id: 'healthcare', label: 'Healthcare', icon: HeartPulse },
  { id: 'realestate', label: 'Real Estate', icon: Home },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'beauty', label: 'Beauty & Spa', icon: Scissors },
  { id: 'technology', label: 'Technology', icon: Laptop },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'nonprofit', label: 'Nonprofit', icon: Heart },
];

type FilterTab = 'all' | 'popular' | 'new' | 'premium';

export default function TemplatesPage() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [previewTemplate, setPreviewTemplate] = useState<WebsiteTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredTemplates = useMemo(() => {
    let templates = WEBSITE_TEMPLATES;

    // Apply search
    if (searchQuery) {
      templates = searchTemplates(searchQuery);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    // Apply tab filter
    if (filterTab === 'popular') {
      templates = templates.filter(t => t.popular);
    } else if (filterTab === 'new') {
      templates = templates.filter(t => t.new);
    } else if (filterTab === 'premium') {
      templates = templates.filter(t => t.premium);
    }

    return templates;
  }, [searchQuery, selectedCategory, filterTab]);

  const handleUseTemplate = (template: WebsiteTemplate) => {
    // Navigate to onboarding with template pre-selected
    router.push(`/onboarding?template=${template.id}&industry=${encodeURIComponent(template.industry)}&style=${template.stylePreset}&color=${encodeURIComponent(template.accentColor)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Website Templates</h1>
                <p className="text-xs text-gray-500">{WEBSITE_TEMPLATES.length} professionally designed templates</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Start from Scratch
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-24">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</h3>
              <nav className="space-y-1">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                      selectedCategory === category.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <category.icon className="w-4 h-4" />
                    {category.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1">
            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-6">
              {[
                { id: 'all' as FilterTab, label: 'All', count: WEBSITE_TEMPLATES.length },
                { id: 'popular' as FilterTab, label: 'Popular', icon: Star },
                { id: 'new' as FilterTab, label: 'New', icon: Sparkles },
                { id: 'premium' as FilterTab, label: 'Premium', icon: Crown },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filterTab === tab.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                  {tab.label}
                  {tab.count && (
                    <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Results count */}
            <p className="text-sm text-gray-500 mb-4">
              Showing {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
              {selectedCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === selectedCategory)?.label}`}
            </p>

            {/* Template grid */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={() => setPreviewTemplate(template)}
                    onUse={() => handleUseTemplate(template)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTemplates.map((template) => (
                  <TemplateListItem
                    key={template.id}
                    template={template}
                    onPreview={() => setPreviewTemplate(template)}
                    onUse={() => handleUseTemplate(template)}
                  />
                ))}
              </div>
            )}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setFilterTab('all');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => {
            handleUseTemplate(previewTemplate);
            setPreviewTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
  onUse,
}: {
  template: WebsiteTemplate;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {template.popular && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
              <Star className="w-3 h-3" fill="currentColor" />
              Popular
            </span>
          )}
          {template.new && (
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
              <Sparkles className="w-3 h-3" />
              New
            </span>
          )}
          {template.premium && (
            <span className="flex items-center gap-1 px-2 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
              <Crown className="w-3 h-3" />
              Premium
            </span>
          )}
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={onUse}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
          >
            <Zap className="w-4 h-4" />
            Use Template
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900">{template.name}</h3>
          <div
            className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: template.accentColor }}
            title={`Accent color: ${template.accentColor}`}
          />
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{template.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
            {template.industry}
          </span>
          <span className="text-xs text-gray-400">
            {template.pages.length} pages
          </span>
        </div>
      </div>
    </div>
  );
}

function TemplateListItem({
  template,
  onPreview,
  onUse,
}: {
  template: WebsiteTemplate;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all flex">
      {/* Thumbnail */}
      <div className="relative w-64 flex-shrink-0 overflow-hidden">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {template.popular && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
              <Star className="w-2.5 h-2.5" fill="currentColor" />
            </span>
          )}
          {template.new && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
              <Sparkles className="w-2.5 h-2.5" />
            </span>
          )}
          {template.premium && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500 text-white text-xs font-medium rounded-full">
              <Crown className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{template.name}</h3>
            <p className="text-sm text-gray-500">{template.industry}</p>
          </div>
          <div
            className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: template.accentColor }}
          />
        </div>
        <p className="text-sm text-gray-600 mb-3 flex-1">{template.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {template.features.slice(0, 3).map((feature, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-gray-500">
                <Check className="w-3 h-3 text-emerald-500" />
                {feature}
              </span>
            ))}
            {template.features.length > 3 && (
              <span className="text-xs text-gray-400">+{template.features.length - 3} more</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={onUse}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
            >
              <Zap className="w-4 h-4" />
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: WebsiteTemplate;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg"
              style={{ backgroundColor: template.accentColor }}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
              <p className="text-sm text-gray-500">{template.industry} • {template.pages.length} pages</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onUse}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
            >
              <Zap className="w-4 h-4" />
              Use This Template
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Preview image */}
            <div className="rounded-xl overflow-hidden border border-gray-200 mb-6">
              <img
                src={template.thumbnail}
                alt={template.name}
                className="w-full"
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{template.description}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Style</h3>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg shadow-sm"
                    style={{ backgroundColor: template.accentColor }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{template.stylePreset}</p>
                    <p className="text-xs text-gray-500">{template.accentColor}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Features Included</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {template.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Pages */}
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Pages</h3>
              <div className="flex flex-wrap gap-2">
                {template.pages.map((page, i) => (
                  <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm">
                    {page}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
