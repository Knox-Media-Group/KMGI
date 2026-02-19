'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Undo2, Redo2, Save, Check, Loader2, Plus, GripVertical,
  ChevronUp, ChevronDown, Trash2, X, Sparkles, Layout, MessageSquare,
  Star, Users, Phone, Image as ImageIcon, FileText, Target, List,
  Bot, Eye, Globe, Monitor, Tablet, Smartphone,
  Type, Square, Minus, AlignLeft, AlignCenter, AlignRight,
  ChevronRight, Copy, Layers,
  Columns2, Columns3, Columns4, Grid3X3, Video, MapPin, Mail, Search,
  Clock, BarChart3, CircleDot, Heading, MousePointerClick,
  SeparatorHorizontal, MoveVertical, GalleryHorizontal, PlayCircle,
  Share2, FormInput, Newspaper, ShoppingCart, LayoutGrid, Container,
  Rows3, PanelLeft, Palette, Zap, Moon, Sun,
} from 'lucide-react';
import { AICopilot } from '@/components/AICopilot';
import type { CopilotAction } from '@/lib/api';
import { useAuthStore, useEditorStore } from '@/lib/store';
import { sitesApi } from '@/lib/api';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Block, TextProps, ImageProps, ButtonProps, ListProps, SiteContent } from '@builder/shared';
import { SECTION_LIBRARY } from '@builder/shared';

// ============================================
// CONSTANTS
// ============================================

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Nunito', label: 'Nunito' },
];

const SHADOW_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Small', css: '0 1px 2px rgba(0,0,0,0.05)' },
  { value: 'md', label: 'Medium', css: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  { value: 'lg', label: 'Large', css: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  { value: 'xl', label: 'Extra Large', css: '0 20px 25px -5px rgba(0,0,0,0.1)' },
];

const MOTION_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'bounce', label: 'Bounce' },
];

const DEVICE_MODES = [
  { id: 'desktop' as const, icon: Monitor, label: 'Desktop', width: '100%' },
  { id: 'tablet' as const, icon: Tablet, label: 'Tablet', width: '768px' },
  { id: 'mobile' as const, icon: Smartphone, label: 'Mobile', width: '375px' },
];

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type LeftTab = 'widgets' | 'sections' | 'pages';
type RightTab = 'content' | 'style' | 'advanced';
type WidgetCategory = 'basic' | 'content' | 'media' | 'forms' | 'layout' | 'ecommerce';

interface WidgetItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: WidgetCategory;
  sectionType: Section['type'];
}

interface GlobalStyles {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
  };
  buttons: {
    borderRadius: number;
    style: 'filled' | 'outline' | 'ghost';
    size: 'sm' | 'md' | 'lg';
  };
  spacing: 'compact' | 'normal' | 'spacious';
  darkMode: boolean;
  animations: boolean;
}

interface BlockStyle {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  borderRadius?: number;
  shadow?: string;
  opacity?: number;
  cssClasses?: string;
  visibleDesktop?: boolean;
  visibleTablet?: boolean;
  visibleMobile?: boolean;
  motionEffect?: string;
  animationDelay?: number;
}

const WIDGET_LIBRARY: WidgetItem[] = [
  // Basic
  { id: 'heading', name: 'Heading', icon: <Heading className="w-5 h-5" />, category: 'basic', sectionType: 'hero' },
  { id: 'text', name: 'Text', icon: <Type className="w-5 h-5" />, category: 'basic', sectionType: 'about' },
  { id: 'image', name: 'Image', icon: <ImageIcon className="w-5 h-5" />, category: 'basic', sectionType: 'gallery' },
  { id: 'button', name: 'Button', icon: <MousePointerClick className="w-5 h-5" />, category: 'basic', sectionType: 'cta' },
  { id: 'spacer', name: 'Spacer', icon: <MoveVertical className="w-5 h-5" />, category: 'basic', sectionType: 'hero' },
  { id: 'divider', name: 'Divider', icon: <SeparatorHorizontal className="w-5 h-5" />, category: 'basic', sectionType: 'hero' },
  // Content
  { id: 'list', name: 'List', icon: <List className="w-5 h-5" />, category: 'content', sectionType: 'services' },
  { id: 'accordion', name: 'Accordion/FAQ', icon: <Rows3 className="w-5 h-5" />, category: 'content', sectionType: 'faq' },
  { id: 'tabs', name: 'Tabs', icon: <PanelLeft className="w-5 h-5" />, category: 'content', sectionType: 'services' },
  { id: 'table', name: 'Table', icon: <Grid3X3 className="w-5 h-5" />, category: 'content', sectionType: 'pricing' },
  { id: 'countdown', name: 'Countdown', icon: <Clock className="w-5 h-5" />, category: 'content', sectionType: 'cta' },
  { id: 'progressbar', name: 'Progress Bar', icon: <BarChart3 className="w-5 h-5" />, category: 'content', sectionType: 'stats' },
  // Media
  { id: 'gallery', name: 'Image Gallery', icon: <GalleryHorizontal className="w-5 h-5" />, category: 'media', sectionType: 'gallery' },
  { id: 'video', name: 'Video', icon: <PlayCircle className="w-5 h-5" />, category: 'media', sectionType: 'hero' },
  { id: 'icon', name: 'Icon', icon: <CircleDot className="w-5 h-5" />, category: 'media', sectionType: 'features' },
  { id: 'social-icons', name: 'Social Icons', icon: <Share2 className="w-5 h-5" />, category: 'media', sectionType: 'socialLinks' },
  { id: 'map', name: 'Map', icon: <MapPin className="w-5 h-5" />, category: 'media', sectionType: 'map' },
  // Forms
  { id: 'contact-form', name: 'Contact Form', icon: <FormInput className="w-5 h-5" />, category: 'forms', sectionType: 'contactForm' },
  { id: 'newsletter', name: 'Newsletter Signup', icon: <Mail className="w-5 h-5" />, category: 'forms', sectionType: 'cta' },
  { id: 'search', name: 'Search', icon: <Search className="w-5 h-5" />, category: 'forms', sectionType: 'hero' },
  // Layout
  { id: 'container', name: 'Container', icon: <Container className="w-5 h-5" />, category: 'layout', sectionType: 'hero' },
  { id: '2-col', name: '2 Columns', icon: <Columns2 className="w-5 h-5" />, category: 'layout', sectionType: 'about' },
  { id: '3-col', name: '3 Columns', icon: <Columns3 className="w-5 h-5" />, category: 'layout', sectionType: 'services' },
  { id: '4-col', name: '4 Columns', icon: <Columns4 className="w-5 h-5" />, category: 'layout', sectionType: 'features' },
  { id: 'section', name: 'Section', icon: <LayoutGrid className="w-5 h-5" />, category: 'layout', sectionType: 'hero' },
  // E-commerce
  { id: 'product-grid', name: 'Product Grid', icon: <ShoppingCart className="w-5 h-5" />, category: 'ecommerce', sectionType: 'products' },
  { id: 'pricing-table', name: 'Pricing Table', icon: <Newspaper className="w-5 h-5" />, category: 'ecommerce', sectionType: 'pricing' },
];

const WIDGET_CATEGORIES: { id: WidgetCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'basic', label: 'Basic', icon: <Square className="w-4 h-4" /> },
  { id: 'content', label: 'Content', icon: <FileText className="w-4 h-4" /> },
  { id: 'media', label: 'Media', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'forms', label: 'Forms', icon: <FormInput className="w-4 h-4" /> },
  { id: 'layout', label: 'Layout', icon: <Layout className="w-4 h-4" /> },
  { id: 'ecommerce', label: 'E-commerce', icon: <ShoppingCart className="w-4 h-4" /> },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hero: <Layout className="w-4 h-4" />,
  about: <FileText className="w-4 h-4" />,
  services: <Target className="w-4 h-4" />,
  features: <Star className="w-4 h-4" />,
  testimonials: <MessageSquare className="w-4 h-4" />,
  team: <Users className="w-4 h-4" />,
  contact: <Phone className="w-4 h-4" />,
  gallery: <ImageIcon className="w-4 h-4" />,
  cta: <Target className="w-4 h-4" />,
  faq: <List className="w-4 h-4" />,
  stats: <BarChart3 className="w-4 h-4" />,
  pricing: <Newspaper className="w-4 h-4" />,
  contactForm: <FormInput className="w-4 h-4" />,
  map: <MapPin className="w-4 h-4" />,
  footer: <Minus className="w-4 h-4" />,
  navigation: <Layout className="w-4 h-4" />,
  timeline: <Clock className="w-4 h-4" />,
  businessHours: <Clock className="w-4 h-4" />,
  socialLinks: <Share2 className="w-4 h-4" />,
  products: <ShoppingCart className="w-4 h-4" />,
};

// ============================================
// ANIMATION STYLES (injected once)
// ============================================

const EDITOR_STYLES = `
  @keyframes editorSlideInLeft {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes editorSlideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes editorFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes editorSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes editorZoomIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes editorBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes editorPulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
    50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
  }
  .anim-slide-in-left { animation: editorSlideInLeft 0.25s ease-out; }
  .anim-slide-in-right { animation: editorSlideInRight 0.25s ease-out; }
  .anim-fade-in { animation: editorFadeIn 0.2s ease-out; }
  .anim-slide-up { animation: editorSlideUp 0.3s ease-out; }
  .anim-zoom-in { animation: editorZoomIn 0.2s ease-out; }

  .editor-canvas-section {
    position: relative;
    transition: all 0.15s ease;
  }
  .editor-canvas-section:hover {
    outline: 2px dashed #c7d2fe;
    outline-offset: -2px;
  }
  .editor-canvas-section.selected {
    outline: 2px solid #6366f1;
    outline-offset: -2px;
  }

  .editor-canvas-block {
    position: relative;
    transition: outline 0.1s ease;
    cursor: pointer;
  }
  .editor-canvas-block:hover {
    outline: 1px dashed #a5b4fc;
    outline-offset: 2px;
  }
  .editor-canvas-block.selected {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .widget-drag-item {
    cursor: grab;
    user-select: none;
    transition: all 0.15s ease;
  }
  .widget-drag-item:hover {
    background-color: #f0f0ff;
    transform: translateY(-1px);
  }
  .widget-drag-item:active {
    cursor: grabbing;
  }

  .panel-scroll::-webkit-scrollbar {
    width: 5px;
  }
  .panel-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .panel-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }
  .panel-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .canvas-drop-zone {
    min-height: 60px;
    transition: all 0.2s ease;
  }
  .canvas-drop-zone.drag-over {
    background: #eef2ff;
    border: 2px dashed #6366f1;
    border-radius: 8px;
  }
`;

// ============================================
// MAIN EDITOR PAGE
// ============================================

export default function EditorPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const { token, tenant } = useAuthStore();
  const {
    pages, settings, selectedPageIndex, selectedSectionId,
    setContent, setSelectedPage, setSelectedSection,
    addSection, deleteSection, moveSection, reorderSections,
    updateBlock, saveSnapshot, undo, redo, canUndo, canRedo,
  } = useEditorStore();

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showCopilot, setShowCopilot] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [leftTab, setLeftTab] = useState<LeftTab>('widgets');
  const [rightTab, setRightTab] = useState<RightTab>('content');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<WidgetCategory | null>('basic');
  const [showGlobalStyles, setShowGlobalStyles] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Block-level style overrides (local state, applied via updateBlock)
  const [blockStyles, setBlockStyles] = useState<Record<string, BlockStyle>>({});

  // Global styles
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>({
    colors: {
      primary: settings?.accentColor || '#6366f1',
      secondary: '#4f46e5',
      accent: '#8b5cf6',
      text: '#111827',
      background: '#ffffff',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseFontSize: 16,
    },
    buttons: {
      borderRadius: 8,
      style: 'filled',
      size: 'md',
    },
    spacing: 'normal',
    darkMode: false,
    animations: true,
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inject editor animation styles
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'editor-styles';
    styleEl.textContent = EDITOR_STYLES;
    if (!document.getElementById('editor-styles')) {
      document.head.appendChild(styleEl);
    }
    return () => {
      const existing = document.getElementById('editor-styles');
      if (existing) existing.remove();
    };
  }, []);

  // Update global styles when settings change
  useEffect(() => {
    if (settings?.accentColor) {
      setGlobalStyles(prev => ({
        ...prev,
        colors: { ...prev.colors, primary: settings.accentColor, accent: settings.accentColor },
      }));
    }
  }, [settings]);

  // ============================================
  // DATA LOADING & SAVING
  // ============================================

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadSite();
  }, [token, siteId]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadSite = async () => {
    if (!token) return;
    try {
      const data = await sitesApi.get(siteId, token);
      if (data.currentVersion) {
        const content = data.currentVersion.pageJson as SiteContent;
        setContent(content);
      }
    } catch (err) {
      console.error('Failed to load site:', err);
      alert('Failed to load site');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!token || pages.length === 0) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      await sitesApi.saveDraft(siteId, pages, token);
      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  }, [token, siteId, pages]);

  const handlePublish = useCallback(async () => {
    if (!token) return;
    try {
      await handleSave();
      await sitesApi.publish(siteId, token);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  }, [token, siteId, handleSave]);

  // Auto-save debounced
  useEffect(() => {
    if (pages.length === 0) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => { handleSave(); }, 3000);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [pages, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) { e.preventDefault(); redo(); }
        else { e.preventDefault(); undo(); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setSelectedBlockId(null);
        setSelectedSection(null);
      }
      if (e.key === 'Delete' && selectedSectionId && !selectedBlockId) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          deleteSection(selectedSectionId);
          saveSnapshot();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave, selectedSectionId, selectedBlockId]);

  // ============================================
  // DRAG & DROP
  // ============================================

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (typeof active.id === 'string' && active.id.startsWith('widget-')) {
      setDraggedWidget(active.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedWidget(null);

    if (!over) return;

    // Widget dropped on canvas
    if (typeof active.id === 'string' && active.id.startsWith('widget-')) {
      const widgetId = (active.id as string).replace('widget-', '');
      const widget = WIDGET_LIBRARY.find(w => w.id === widgetId);
      if (widget) {
        addSection(widget.sectionType);
        saveSnapshot();
      }
      return;
    }

    // Section reorder
    if (over && active.id !== over.id) {
      const page = pages[selectedPageIndex];
      if (!page) return;
      const oldIndex = page.sections.findIndex(s => s.id === active.id);
      const newIndex = page.sections.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSections(selectedPageIndex, oldIndex, newIndex);
        saveSnapshot();
      }
    }
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleAddSection = (type: Section['type']) => {
    addSection(type);
    saveSnapshot();
  };

  const handleDeleteSection = (id: string) => {
    deleteSection(id);
    if (selectedSectionId === id) setSelectedSection(null);
    setSelectedBlockId(null);
    saveSnapshot();
  };

  const handleSelectSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedBlockId(null);
    setRightPanelOpen(true);
  };

  const handleSelectBlock = (sectionId: string, blockId: string) => {
    setSelectedSection(sectionId);
    setSelectedBlockId(blockId);
    setRightPanelOpen(true);
    setRightTab('content');
  };

  const handleBlockChange = (sectionId: string, blockId: string, props: Partial<Block['props']>) => {
    updateBlock(sectionId, blockId, props);
  };

  const handleBlockBlur = () => {
    saveSnapshot();
  };

  const handleCopilotAction = (action: CopilotAction) => {
    if (action.type === 'update_text' && action.target.sectionId && action.target.blockId) {
      const payload = action.payload as { content: string };
      updateBlock(action.target.sectionId, action.target.blockId, { content: payload.content });
      saveSnapshot();
    }
  };

  const handleBlockStyleChange = (sectionId: string, blockId: string, key: keyof BlockStyle, value: unknown) => {
    const styleKey = `${sectionId}-${blockId}`;
    setBlockStyles(prev => ({
      ...prev,
      [styleKey]: { ...(prev[styleKey] || {}), [key]: value },
    }));
    // For certain style props that map to block props, update the block too
    if (key === 'textColor' || key === 'backgroundColor' || key === 'fontSize' || key === 'fontFamily') {
      updateBlock(sectionId, blockId, { [key]: value } as Partial<Block['props']>);
    }
  };

  const getBlockStyle = (sectionId: string, blockId: string): BlockStyle => {
    return blockStyles[`${sectionId}-${blockId}`] || {};
  };

  // ============================================
  // DERIVED STATE
  // ============================================

  const currentPage = pages[selectedPageIndex];
  const selectedSection = currentPage?.sections.find(s => s.id === selectedSectionId);
  const selectedBlock = selectedSection?.blocks.find(b => b.id === selectedBlockId);

  const canvasWidth = useMemo(() => {
    return DEVICE_MODES.find(d => d.id === deviceMode)?.width || '100%';
  }, [deviceMode]);

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500 font-medium">Loading editor...</p>
          <p className="text-gray-400 text-sm mt-1">Preparing your workspace</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* ========== TOP BAR ========== */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 flex-shrink-0 z-50">
        {/* Left group */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden lg:inline">Dashboard</span>
          </Link>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
              {settings?.businessName || 'Untitled Site'}
            </span>
          </div>
        </div>

        {/* Center: Page Tabs */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 mx-3">
          {pages.map((page, index) => (
            <button
              key={page.slug}
              onClick={() => { setSelectedPage(index); setSelectedSection(null); setSelectedBlockId(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedPageIndex === index
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>

        {/* Right group */}
        <div className="flex items-center gap-2">
          {/* Device preview */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {DEVICE_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setDeviceMode(mode.id)}
                className={`p-1.5 rounded-md transition-all ${
                  deviceMode === mode.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title={mode.label}
              >
                <mode.icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Global Styles */}
          <button
            onClick={() => setShowGlobalStyles(!showGlobalStyles)}
            className={`p-2 rounded-lg transition-all ${
              showGlobalStyles ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Global Styles"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Save status */}
          <div className="flex items-center gap-1.5 text-xs min-w-[80px]">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            {saveStatus === 'idle' && lastSaved && (
              <span className="text-gray-400 hidden xl:block">
                {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* AI Co-Pilot */}
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showCopilot
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-sm'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Co-Pilot</span>
          </button>

          {/* Preview */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 transition-all"
            title="Preview site in new tab"
            onClick={() => {
              const previewWindow = window.open('', '_blank');
              if (previewWindow) {
                previewWindow.document.write('<html><head><title>Preview</title></head><body><p>Preview loading...</p></body></html>');
              }
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* ========== MAIN CONTENT (3-panel) ========== */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* ========== LEFT PANEL (280px) ========== */}
          {leftPanelOpen && (
            <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 anim-slide-in-left">
              {/* Left Panel Tabs */}
              <div className="flex border-b border-gray-200 flex-shrink-0">
                {(['widgets', 'sections', 'pages'] as LeftTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setLeftTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all ${
                      leftTab === tab
                        ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Left Panel Content */}
              <div className="flex-1 overflow-y-auto panel-scroll">
                {leftTab === 'widgets' && (
                  <WidgetPanel
                    expandedCategory={expandedCategory}
                    onToggleCategory={cat => setExpandedCategory(expandedCategory === cat ? null : cat)}
                  />
                )}
                {leftTab === 'sections' && (
                  <SectionTemplatesPanel onAddSection={handleAddSection} />
                )}
                {leftTab === 'pages' && (
                  <PagesPanel
                    pages={pages}
                    selectedPageIndex={selectedPageIndex}
                    onSelectPage={index => { setSelectedPage(index); setSelectedSection(null); setSelectedBlockId(null); }}
                  />
                )}
              </div>
            </aside>
          )}

          {/* Left panel toggle */}
          {!leftPanelOpen && (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="w-10 bg-white border-r border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0"
              title="Open widget panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* ========== CENTER: CANVAS ========== */}
          <main className="flex-1 overflow-auto bg-gray-100 relative" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSection(null);
              setSelectedBlockId(null);
            }
          }}>
            {/* Canvas toolbar (collapse buttons) */}
            <div className="absolute top-3 left-3 z-10 flex gap-1.5">
              {leftPanelOpen && (
                <button
                  onClick={() => setLeftPanelOpen(false)}
                  className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-400 hover:text-gray-600 transition-all"
                  title="Collapse left panel"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Canvas container */}
            <div className="p-6 flex justify-center min-h-full">
              <div
                className="transition-all duration-300 ease-in-out"
                style={{ width: canvasWidth, maxWidth: '100%' }}
              >
                {/* Canvas Frame */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200/80">
                  {/* Device frame top bar (decorative) */}
                  {deviceMode !== 'desktop' && (
                    <div className="bg-gray-800 px-4 py-2 flex items-center justify-center">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                    </div>
                  )}

                  {/* Canvas Sections */}
                  {currentPage && (
                    <SortableContext
                      items={currentPage.sections.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <CanvasDropZone>
                        {currentPage.sections.map(section => (
                          <SortableCanvasSection
                            key={section.id}
                            section={section}
                            isSelected={selectedSectionId === section.id}
                            selectedBlockId={selectedBlockId}
                            accentColor={globalStyles.colors.primary}
                            globalStyles={globalStyles}
                            blockStyles={blockStyles}
                            onSelectSection={() => handleSelectSection(section.id)}
                            onSelectBlock={(blockId) => handleSelectBlock(section.id, blockId)}
                            onDelete={() => handleDeleteSection(section.id)}
                            onMoveUp={() => { moveSection(section.id, 'up'); saveSnapshot(); }}
                            onMoveDown={() => { moveSection(section.id, 'down'); saveSnapshot(); }}
                            onBlockChange={handleBlockChange}
                            onBlockBlur={handleBlockBlur}
                          />
                        ))}
                      </CanvasDropZone>
                    </SortableContext>
                  )}

                  {/* Add section button at bottom */}
                  <div className="p-6 border-t border-dashed border-gray-200 bg-gray-50/50 text-center">
                    <button
                      onClick={() => { setLeftTab('sections'); setLeftPanelOpen(true); }}
                      className="inline-flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-300 transition-all text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Section
                    </button>
                  </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Click sections or blocks to edit. Drag widgets from the left panel to add elements.
                </p>
              </div>
            </div>
          </main>

          {/* Drag overlay */}
          <DragOverlay>
            {draggedWidget && (
              <div className="bg-white rounded-lg shadow-xl border-2 border-indigo-400 px-4 py-2 text-sm font-medium text-indigo-700 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {WIDGET_LIBRARY.find(w => `widget-${w.id}` === draggedWidget)?.name || 'Widget'}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* ========== RIGHT PANEL (320px) ========== */}
        {rightPanelOpen && (selectedSection || showGlobalStyles) && (
          <aside className="w-[320px] bg-white border-l border-gray-200 flex flex-col flex-shrink-0 anim-slide-in-right">
            {showGlobalStyles ? (
              <GlobalStylesPanel
                styles={globalStyles}
                onChange={setGlobalStyles}
                onClose={() => setShowGlobalStyles(false)}
              />
            ) : (
              <PropertiesPanel
                section={selectedSection!}
                block={selectedBlock || null}
                blockStyle={selectedBlock && selectedSectionId ? getBlockStyle(selectedSectionId, selectedBlock.id) : {}}
                activeTab={rightTab}
                onTabChange={setRightTab}
                onBlockChange={(blockId, props) => {
                  if (selectedSectionId) handleBlockChange(selectedSectionId, blockId, props);
                }}
                onBlockStyleChange={(blockId, key, value) => {
                  if (selectedSectionId) handleBlockStyleChange(selectedSectionId, blockId, key, value);
                }}
                onBlockBlur={handleBlockBlur}
                onClose={() => { setRightPanelOpen(false); setShowGlobalStyles(false); }}
                accentColor={globalStyles.colors.primary}
              />
            )}
          </aside>
        )}

        {/* Right panel toggle */}
        {(!rightPanelOpen || (!selectedSection && !showGlobalStyles)) && (
          <div className="w-10 bg-white border-l border-gray-200 flex-shrink-0" />
        )}
      </div>

      {/* ========== AI COPILOT ========== */}
      {token && settings && currentPage && (
        <AICopilot
          isOpen={showCopilot}
          onClose={() => setShowCopilot(false)}
          token={token}
          siteSettings={settings}
          currentPage={currentPage}
          selectedSection={selectedSection}
          onApplyAction={handleCopilotAction}
        />
      )}
    </div>
  );
}

// ============================================
// LEFT PANEL: WIDGET LIBRARY
// ============================================

function WidgetPanel({
  expandedCategory,
  onToggleCategory,
}: {
  expandedCategory: WidgetCategory | null;
  onToggleCategory: (cat: WidgetCategory) => void;
}) {
  return (
    <div className="p-2">
      {WIDGET_CATEGORIES.map(cat => {
        const widgets = WIDGET_LIBRARY.filter(w => w.category === cat.id);
        const isExpanded = expandedCategory === cat.id;

        return (
          <div key={cat.id} className="mb-1">
            <button
              onClick={() => onToggleCategory(cat.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{cat.icon}</span>
                {cat.label}
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            {isExpanded && (
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-2 anim-fade-in">
                {widgets.map(widget => (
                  <DraggableWidget key={widget.id} widget={widget} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DraggableWidget({ widget }: { widget: WidgetItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `widget-${widget.id}`,
    data: { type: 'widget', widget },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`widget-drag-item flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-100 bg-white ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
    >
      <span className="text-gray-500">{widget.icon}</span>
      <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">{widget.name}</span>
    </div>
  );
}

// ============================================
// LEFT PANEL: SECTION TEMPLATES
// ============================================

function SectionTemplatesPanel({ onAddSection }: { onAddSection: (type: Section['type']) => void }) {
  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-gray-400 font-medium px-1 mb-2">PRE-BUILT SECTIONS</p>
      {SECTION_LIBRARY.map(item => (
        <button
          key={item.type}
          onClick={() => onAddSection(item.type)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center text-gray-500 group-hover:text-indigo-600 transition-colors flex-shrink-0">
            {SECTION_ICONS[item.type] || <Layout className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 group-hover:text-indigo-700">{item.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{item.description}</div>
          </div>
          <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 ml-auto flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ============================================
// LEFT PANEL: PAGES
// ============================================

function PagesPanel({
  pages,
  selectedPageIndex,
  onSelectPage,
}: {
  pages: { title: string; slug: string; sections: Section[] }[];
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
}) {
  return (
    <div className="p-3 space-y-1.5">
      <p className="text-xs text-gray-400 font-medium px-1 mb-2">PAGES ({pages.length})</p>
      {pages.map((page, index) => (
        <button
          key={page.slug}
          onClick={() => onSelectPage(index)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left ${
            selectedPageIndex === index
              ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
              : 'hover:bg-gray-50 border border-transparent text-gray-700'
          }`}
        >
          <FileText className={`w-4 h-4 flex-shrink-0 ${selectedPageIndex === index ? 'text-indigo-500' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <div className="text-sm font-medium">{page.title}</div>
            <div className="text-[10px] text-gray-400">/{page.slug} &middot; {page.sections.length} sections</div>
          </div>
          {selectedPageIndex === index && <Check className="w-3.5 h-3.5 text-indigo-500 ml-auto flex-shrink-0" />}
        </button>
      ))}
    </div>
  );
}

// ============================================
// CANVAS: DROP ZONE WRAPPER
// ============================================

function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`canvas-drop-zone min-h-[200px] ${isOver ? 'drag-over' : ''}`}
    >
      {children}
    </div>
  );
}

// ============================================
// CANVAS: SORTABLE SECTION
// ============================================

function SortableCanvasSection({
  section,
  isSelected,
  selectedBlockId,
  accentColor,
  globalStyles,
  blockStyles,
  onSelectSection,
  onSelectBlock,
  onDelete,
  onMoveUp,
  onMoveDown,
  onBlockChange,
  onBlockBlur,
}: {
  section: Section;
  isSelected: boolean;
  selectedBlockId: string | null;
  accentColor: string;
  globalStyles: GlobalStyles;
  blockStyles: Record<string, BlockStyle>;
  onSelectSection: () => void;
  onSelectBlock: (blockId: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onBlockChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlockBlur: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sectionBg = getSectionBackground(section, accentColor, globalStyles);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-canvas-section relative group ${isSelected ? 'selected' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSection();
      }}
    >
      {/* Section Controls Overlay */}
      <div
        className={`absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-1.5 py-1 z-20 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab rounded transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors" title="Move up">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors" title="Move down">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Section type label */}
      <div className={`absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-[10px] font-semibold text-gray-500 uppercase tracking-wide z-20 flex items-center gap-1.5 ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      } transition-opacity`}>
        {SECTION_ICONS[section.type] || <Layout className="w-3 h-3" />}
        {section.type}
      </div>

      {/* Section visual render */}
      <div style={sectionBg} className="relative">
        <div className="max-w-4xl mx-auto px-6 py-8 md:py-12">
          <SectionBlocksRenderer
            section={section}
            selectedBlockId={selectedBlockId}
            accentColor={accentColor}
            globalStyles={globalStyles}
            blockStyles={blockStyles}
            onSelectBlock={onSelectBlock}
            onBlockChange={onBlockChange}
            onBlockBlur={onBlockBlur}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// CANVAS: SECTION BLOCKS RENDERER
// ============================================

function SectionBlocksRenderer({
  section,
  selectedBlockId,
  accentColor,
  globalStyles,
  blockStyles,
  onSelectBlock,
  onBlockChange,
  onBlockBlur,
}: {
  section: Section;
  selectedBlockId: string | null;
  accentColor: string;
  globalStyles: GlobalStyles;
  blockStyles: Record<string, BlockStyle>;
  onSelectBlock: (blockId: string) => void;
  onBlockChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlockBlur: () => void;
}) {
  // Render blocks based on section type for visual layout
  const isGridSection = ['features', 'services', 'team', 'stats', 'products', 'pricing', 'gallery'].includes(section.type);
  const textBlocks = section.blocks.filter(b => b.type === 'text');
  const listBlocks = section.blocks.filter(b => b.type === 'list');
  const buttonBlocks = section.blocks.filter(b => b.type === 'button');
  const imageBlocks = section.blocks.filter(b => b.type === 'image');
  const statBlocks = section.blocks.filter(b => b.type === 'stat');
  const teamBlocks = section.blocks.filter(b => b.type === 'teamMember');
  const cardBlocks = section.blocks.filter(b => b.type === 'card');
  const accordionBlocks = section.blocks.filter(b => b.type === 'accordion');
  const formBlocks = section.blocks.filter(b => b.type === 'form');
  const mapBlocks = section.blocks.filter(b => b.type === 'map');
  const socialBlocks = section.blocks.filter(b => b.type === 'social');
  const hoursBlocks = section.blocks.filter(b => b.type === 'hours');
  const timelineBlocks = section.blocks.filter(b => b.type === 'timelineItem');

  // For hero sections, hide image blocks (used as background) and center content
  const isHero = section.type === 'hero';
  const isCta = section.type === 'cta';
  const blocksToRender = isHero
    ? section.blocks.filter(b => b.type !== 'image')
    : section.blocks;

  return (
    <div className={`space-y-4 ${isHero || isCta ? 'text-center' : ''}`}>
      {/* Render blocks */}
      {blocksToRender.map(block => {
        const bStyle = blockStyles[`${section.id}-${block.id}`] || {};
        const isBlockSelected = selectedBlockId === block.id;

        // Override text color for hero/cta sections
        const heroStyle = (isHero || isCta) && block.type === 'text'
          ? { color: 'inherit' }
          : {};

        return (
          <div
            key={block.id}
            className={`editor-canvas-block ${isBlockSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBlock(block.id);
            }}
            style={heroStyle}
          >
            <CanvasBlockRenderer
              block={block}
              sectionId={section.id}
              section={section}
              accentColor={accentColor}
              globalStyles={globalStyles}
              blockStyle={{ ...bStyle, ...(isHero || isCta ? { textColor: '#ffffff' } : {}) }}
              onChange={onBlockChange}
              onBlur={onBlockBlur}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// CANVAS: BLOCK RENDERER
// ============================================

function CanvasBlockRenderer({
  block,
  sectionId,
  section,
  accentColor,
  globalStyles,
  blockStyle,
  onChange,
  onBlur,
}: {
  block: Block;
  sectionId: string;
  section: Section;
  accentColor: string;
  globalStyles: GlobalStyles;
  blockStyle: BlockStyle;
  onChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlur: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const computedStyle: React.CSSProperties = {
    ...(blockStyle.backgroundColor ? { backgroundColor: blockStyle.backgroundColor } : {}),
    ...(blockStyle.textColor ? { color: blockStyle.textColor } : {}),
    ...(blockStyle.fontSize ? { fontSize: `${blockStyle.fontSize}px` } : {}),
    ...(blockStyle.fontFamily ? { fontFamily: blockStyle.fontFamily } : {}),
    ...(blockStyle.paddingTop !== undefined ? { paddingTop: `${blockStyle.paddingTop}px` } : {}),
    ...(blockStyle.paddingRight !== undefined ? { paddingRight: `${blockStyle.paddingRight}px` } : {}),
    ...(blockStyle.paddingBottom !== undefined ? { paddingBottom: `${blockStyle.paddingBottom}px` } : {}),
    ...(blockStyle.paddingLeft !== undefined ? { paddingLeft: `${blockStyle.paddingLeft}px` } : {}),
    ...(blockStyle.borderRadius !== undefined ? { borderRadius: `${blockStyle.borderRadius}px` } : {}),
    ...(blockStyle.shadow && blockStyle.shadow !== 'none' ? { boxShadow: SHADOW_PRESETS.find(s => s.value === blockStyle.shadow)?.css } : {}),
    ...(blockStyle.opacity !== undefined ? { opacity: blockStyle.opacity / 100 } : {}),
  };

  switch (block.type) {
    case 'text': {
      const props = block.props as TextProps;
      const Tag = getTextTag(props.variant);
      const className = getTextClassName(props.variant, section, globalStyles);
      const align = props.align || 'left';

      return (
        <Tag
          contentEditable
          suppressContentEditableWarning
          className={`${className} outline-none focus:bg-blue-50/30 rounded transition-colors`}
          style={{ ...computedStyle, textAlign: align, fontFamily: computedStyle.fontFamily || (props.variant?.startsWith('h') ? globalStyles.typography.headingFont : globalStyles.typography.bodyFont) }}
          onBlur={(e) => {
            onChange(sectionId, block.id, { content: e.currentTarget.textContent || '' });
            onBlur();
          }}
        >
          {props.content}
        </Tag>
      );
    }

    case 'image': {
      const props = block.props as ImageProps;
      return (
        <div className="my-3" style={computedStyle}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  onChange(sectionId, block.id, { src: ev.target?.result as string });
                  onBlur();
                };
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
          />
          <div className="relative group/img cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img
              src={props.src || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop'}
              alt={props.alt || 'Image'}
              className={`w-full h-auto object-cover ${props.rounded ? 'rounded-xl' : 'rounded-lg'} ${props.shadow ? 'shadow-lg' : ''}`}
              style={{ maxHeight: '400px' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity">
              <div className="bg-white px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
                <ImageIcon className="w-4 h-4" /> Replace Image
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'button': {
      const props = block.props as ButtonProps;
      const btnStyle = getButtonStyle(props, accentColor, globalStyles);
      return (
        <div className="my-3" style={{ textAlign: (section.blocks.find(b => b.type === 'text')?.props as TextProps)?.align || 'left' }}>
          <span
            contentEditable
            suppressContentEditableWarning
            className="inline-block cursor-text outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
            style={{ ...btnStyle, ...computedStyle }}
            onBlur={(e) => {
              onChange(sectionId, block.id, { text: e.currentTarget.textContent || '' });
              onBlur();
            }}
          >
            {props.text}
          </span>
        </div>
      );
    }

    case 'list': {
      const props = block.props as ListProps;
      const cols = props.columns || 3;
      const isGrid = props.layout === 'grid' || props.layout === 'cards';

      return (
        <div
          className={`my-4 ${isGrid ? `grid gap-4` : 'space-y-3'}`}
          style={isGrid ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...computedStyle } : computedStyle}
        >
          {props.items.map((item, index) => (
            <div key={item.id} className="p-4 bg-white/80 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all">
              {item.image && (
                <div className="mb-3 rounded-lg overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-32 object-cover" />
                </div>
              )}
              <div
                contentEditable
                suppressContentEditableWarning
                className="font-semibold text-gray-900 text-sm outline-none"
                onBlur={(e) => {
                  const newItems = [...props.items];
                  newItems[index] = { ...item, title: e.currentTarget.textContent || '' };
                  onChange(sectionId, block.id, { items: newItems });
                  onBlur();
                }}
              >
                {item.title}
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                className="text-gray-500 text-xs mt-1 outline-none leading-relaxed"
                onBlur={(e) => {
                  const newItems = [...props.items];
                  newItems[index] = { ...item, description: e.currentTarget.textContent || '' };
                  onChange(sectionId, block.id, { items: newItems });
                  onBlur();
                }}
              >
                {item.description}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'stat': {
      const props = block.props as import('@builder/shared').StatProps;
      return (
        <div className="text-center p-4" style={computedStyle}>
          <div className="text-3xl font-bold" style={{ color: accentColor }}>
            {props.prefix}{props.value}{props.suffix}
          </div>
          <div className="text-sm text-gray-500 mt-1">{props.label}</div>
        </div>
      );
    }

    case 'teamMember': {
      const props = block.props as import('@builder/shared').TeamMemberProps;
      return (
        <div className="text-center p-4" style={computedStyle}>
          <div className="w-20 h-20 mx-auto rounded-full bg-gray-200 mb-3 overflow-hidden">
            <img src={props.image || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop'} alt={props.name} className="w-full h-full object-cover" />
          </div>
          <div className="font-semibold text-gray-900 text-sm">{props.name}</div>
          <div className="text-xs text-gray-500">{props.role}</div>
          {props.bio && <div className="text-xs text-gray-400 mt-1">{props.bio}</div>}
        </div>
      );
    }

    case 'card': {
      const props = block.props as import('@builder/shared').CardProps;
      return (
        <div className={`p-4 rounded-xl border ${props.highlighted ? 'border-indigo-300 shadow-md ring-2 ring-indigo-100' : 'border-gray-200'} bg-white`} style={computedStyle}>
          {props.image && <img src={props.image} alt={props.title} className="w-full h-32 object-cover rounded-lg mb-3" />}
          <div className="font-semibold text-gray-900">{props.title}</div>
          {props.price && <div className="text-lg font-bold mt-1" style={{ color: accentColor }}>{props.price}</div>}
          <div className="text-xs text-gray-500 mt-1">{props.description}</div>
          {props.features && (
            <ul className="mt-2 space-y-1">
              {props.features.map((f, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
          )}
          {props.linkText && (
            <button className="mt-3 w-full py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
              {props.linkText}
            </button>
          )}
        </div>
      );
    }

    case 'accordion': {
      const props = block.props as import('@builder/shared').AccordionProps;
      return (
        <div className="space-y-2 my-4" style={computedStyle}>
          {props.items.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 font-medium text-sm text-gray-800">
                {item.question}
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">{item.answer}</div>
            </div>
          ))}
        </div>
      );
    }

    case 'form': {
      const props = block.props as import('@builder/shared').FormProps;
      return (
        <div className="my-4 space-y-3" style={computedStyle}>
          {props.fields.map(field => (
            <div key={field.id}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}{field.required && <span className="text-red-500">*</span>}</label>
              {field.type === 'textarea' ? (
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 min-h-[80px]">{field.placeholder}</div>
              ) : (
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400">{field.placeholder}</div>
              )}
            </div>
          ))}
          <button className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: accentColor }}>
            {props.submitText}
          </button>
        </div>
      );
    }

    case 'map': {
      const props = block.props as import('@builder/shared').MapProps;
      return (
        <div className="my-4 rounded-lg overflow-hidden border border-gray-200" style={{ height: props.height || 300, ...computedStyle }}>
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2" />
              <div className="text-sm font-medium">{props.address || 'Map Embed'}</div>
              <div className="text-xs mt-1">Google Maps will appear here</div>
            </div>
          </div>
        </div>
      );
    }

    case 'social': {
      const props = block.props as import('@builder/shared').SocialProps;
      return (
        <div className="flex items-center gap-3 my-4" style={computedStyle}>
          {props.links.map(link => (
            <div key={link.id} className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accentColor }}>
              {link.platform.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      );
    }

    case 'hours': {
      const props = block.props as import('@builder/shared').HoursProps;
      return (
        <div className="my-4 space-y-2" style={computedStyle}>
          {props.hours.map(day => (
            <div key={day.day} className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="capitalize font-medium text-gray-700">{day.day}</span>
              <span className="text-gray-500">{day.closed ? 'Closed' : `${day.open} - ${day.close}`}</span>
            </div>
          ))}
          {props.note && <p className="text-xs text-gray-400 italic mt-2">{props.note}</p>}
        </div>
      );
    }

    case 'timelineItem': {
      const props = block.props as import('@builder/shared').TimelineItemProps;
      return (
        <div className="flex gap-4 my-3" style={computedStyle}>
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: accentColor }}>
              {props.year.slice(-2)}
            </div>
            <div className="w-px flex-1 bg-gray-200 mt-1" />
          </div>
          <div className="pb-6">
            <div className="text-xs font-bold text-gray-400 uppercase">{props.year}</div>
            <div className="font-semibold text-gray-900 text-sm">{props.title}</div>
            <div className="text-xs text-gray-500 mt-1">{props.description}</div>
          </div>
        </div>
      );
    }

    case 'divider':
      return <hr className="my-4 border-gray-200" style={computedStyle} />;

    case 'spacer': {
      const props = block.props as import('@builder/shared').SpacerProps;
      const heights = { sm: 16, md: 32, lg: 48, xl: 64 };
      return <div style={{ height: heights[props.height] || 32, ...computedStyle }} />;
    }

    case 'video': {
      const props = block.props as import('@builder/shared').VideoProps;
      return (
        <div className="my-4 rounded-lg overflow-hidden bg-gray-900 aspect-video flex items-center justify-center" style={computedStyle}>
          <div className="text-center text-gray-400">
            <PlayCircle className="w-12 h-12 mx-auto mb-2" />
            <div className="text-sm">Video Player</div>
            <div className="text-xs mt-1">{props.src || 'No video URL set'}</div>
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="my-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 text-center" style={computedStyle}>
          {block.type} block
        </div>
      );
  }
}

// ============================================
// RIGHT PANEL: PROPERTIES EDITOR
// ============================================

function PropertiesPanel({
  section,
  block,
  blockStyle,
  activeTab,
  onTabChange,
  onBlockChange,
  onBlockStyleChange,
  onBlockBlur,
  onClose,
  accentColor,
}: {
  section: Section;
  block: Block | null;
  blockStyle: BlockStyle;
  activeTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  onBlockChange: (blockId: string, props: Partial<Block['props']>) => void;
  onBlockStyleChange: (blockId: string, key: keyof BlockStyle, value: unknown) => void;
  onBlockBlur: () => void;
  onClose: () => void;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {block ? `${block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block` : `${section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section`}
          </div>
          <div className="text-[10px] text-gray-400">
            {block ? `ID: ${block.id.slice(0, 8)}...` : `${section.blocks.length} blocks`}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(['content', 'style', 'advanced'] as RightTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2 text-xs font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-4">
        {activeTab === 'content' && (
          <ContentTab
            section={section}
            block={block}
            onBlockChange={onBlockChange}
            onBlockBlur={onBlockBlur}
          />
        )}
        {activeTab === 'style' && (
          <StyleTab
            section={section}
            block={block}
            blockStyle={blockStyle}
            onBlockStyleChange={onBlockStyleChange}
            accentColor={accentColor}
          />
        )}
        {activeTab === 'advanced' && (
          <AdvancedTab
            section={section}
            block={block}
            blockStyle={blockStyle}
            onBlockStyleChange={onBlockStyleChange}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// RIGHT PANEL: CONTENT TAB
// ============================================

function ContentTab({
  section,
  block,
  onBlockChange,
  onBlockBlur,
}: {
  section: Section;
  block: Block | null;
  onBlockChange: (blockId: string, props: Partial<Block['props']>) => void;
  onBlockBlur: () => void;
}) {
  if (!block) {
    // Section-level content editing
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">Select a block in the canvas to edit its content, or edit blocks below:</p>
        {section.blocks.map((b, i) => (
          <div key={b.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">{b.type} #{i + 1}</div>
            {b.type === 'text' && (
              <textarea
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                rows={2}
                value={(b.props as TextProps).content}
                onChange={(e) => onBlockChange(b.id, { content: e.target.value })}
                onBlur={onBlockBlur}
              />
            )}
            {b.type === 'button' && (
              <div className="space-y-2">
                <input
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={(b.props as ButtonProps).text}
                  onChange={(e) => onBlockChange(b.id, { text: e.target.value })}
                  onBlur={onBlockBlur}
                  placeholder="Button text"
                />
                <input
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={(b.props as ButtonProps).href}
                  onChange={(e) => onBlockChange(b.id, { href: e.target.value })}
                  onBlur={onBlockBlur}
                  placeholder="Link URL"
                />
              </div>
            )}
            {b.type === 'image' && (
              <input
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={(b.props as ImageProps).alt}
                onChange={(e) => onBlockChange(b.id, { alt: e.target.value })}
                onBlur={onBlockBlur}
                placeholder="Alt text"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Block-level content editing
  switch (block.type) {
    case 'text': {
      const props = block.props as TextProps;
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Text Content</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={4}
              value={props.content}
              onChange={(e) => onBlockChange(block.id, { content: e.target.value })}
              onBlur={onBlockBlur}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Variant</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.variant}
              onChange={(e) => { onBlockChange(block.id, { variant: e.target.value as TextProps['variant'] }); onBlockBlur(); }}
            >
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="lead">Lead Text</option>
              <option value="body">Body</option>
              <option value="small">Small</option>
              <option value="caption">Caption</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alignment</label>
            <div className="flex gap-1">
              {[
                { value: 'left', icon: <AlignLeft className="w-4 h-4" /> },
                { value: 'center', icon: <AlignCenter className="w-4 h-4" /> },
                { value: 'right', icon: <AlignRight className="w-4 h-4" /> },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onBlockChange(block.id, { align: opt.value as TextProps['align'] }); onBlockBlur(); }}
                  className={`flex-1 p-2 rounded-lg border transition-all ${
                    (props.align || 'left') === opt.value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                      : 'border-gray-200 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'button': {
      const props = block.props as ButtonProps;
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Button Text</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.text}
              onChange={(e) => onBlockChange(block.id, { text: e.target.value })}
              onBlur={onBlockBlur}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Link URL</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.href}
              onChange={(e) => onBlockChange(block.id, { href: e.target.value })}
              onBlur={onBlockBlur}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Variant</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.variant}
              onChange={(e) => { onBlockChange(block.id, { variant: e.target.value as ButtonProps['variant'] }); onBlockBlur(); }}
            >
              <option value="primary">Primary (Filled)</option>
              <option value="secondary">Secondary</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Size</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.size || 'md'}
              onChange={(e) => { onBlockChange(block.id, { size: e.target.value as ButtonProps['size'] }); onBlockBlur(); }}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </div>
      );
    }

    case 'image': {
      const props = block.props as ImageProps;
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Image URL</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.src}
              onChange={(e) => onBlockChange(block.id, { src: e.target.value })}
              onBlur={onBlockBlur}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alt Text</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={props.alt}
              onChange={(e) => onBlockChange(block.id, { alt: e.target.value })}
              onBlur={onBlockBlur}
              placeholder="Describe the image"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={props.rounded || false}
                onChange={(e) => { onBlockChange(block.id, { rounded: e.target.checked }); onBlockBlur(); }}
                className="rounded border-gray-300"
              />
              Rounded
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={props.shadow || false}
                onChange={(e) => { onBlockChange(block.id, { shadow: e.target.checked }); onBlockBlur(); }}
                className="rounded border-gray-300"
              />
              Shadow
            </label>
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="text-xs text-gray-400 text-center py-4">
          Select a text, button, or image block to edit content.
        </div>
      );
  }
}

// ============================================
// RIGHT PANEL: STYLE TAB
// ============================================

function StyleTab({
  section,
  block,
  blockStyle,
  onBlockStyleChange,
  accentColor,
}: {
  section: Section;
  block: Block | null;
  blockStyle: BlockStyle;
  onBlockStyleChange: (blockId: string, key: keyof BlockStyle, value: unknown) => void;
  accentColor: string;
}) {
  const targetId = block?.id || section.id;

  return (
    <div className="space-y-5">
      {/* Background Color */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={blockStyle.backgroundColor || '#ffffff'}
            onChange={(e) => onBlockStyleChange(targetId, 'backgroundColor', e.target.value)}
            className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={blockStyle.backgroundColor || ''}
            onChange={(e) => onBlockStyleChange(targetId, 'backgroundColor', e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={blockStyle.textColor || '#111827'}
            onChange={(e) => onBlockStyleChange(targetId, 'textColor', e.target.value)}
            className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={blockStyle.textColor || ''}
            onChange={(e) => onBlockStyleChange(targetId, 'textColor', e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            placeholder="#111827"
          />
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Font Size: <span className="text-indigo-600">{blockStyle.fontSize || 16}px</span>
        </label>
        <input
          type="range"
          min={10}
          max={72}
          value={blockStyle.fontSize || 16}
          onChange={(e) => onBlockStyleChange(targetId, 'fontSize', parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Font Family</label>
        <select
          value={blockStyle.fontFamily || ''}
          onChange={(e) => onBlockStyleChange(targetId, 'fontFamily', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Default</option>
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Padding */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Padding</label>
        <div className="grid grid-cols-2 gap-2">
          {(['Top', 'Right', 'Bottom', 'Left'] as const).map(dir => {
            const key = `padding${dir}` as keyof BlockStyle;
            return (
              <div key={dir} className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-8">{dir[0]}</span>
                <input
                  type="range"
                  min={0}
                  max={64}
                  value={(blockStyle[key] as number) || 0}
                  onChange={(e) => onBlockStyleChange(targetId, key, parseInt(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-[10px] text-gray-500 w-6 text-right">{(blockStyle[key] as number) || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Margin */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Margin</label>
        <div className="grid grid-cols-2 gap-2">
          {(['Top', 'Right', 'Bottom', 'Left'] as const).map(dir => {
            const key = `margin${dir}` as keyof BlockStyle;
            return (
              <div key={dir} className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-8">{dir[0]}</span>
                <input
                  type="range"
                  min={0}
                  max={64}
                  value={(blockStyle[key] as number) || 0}
                  onChange={(e) => onBlockStyleChange(targetId, key, parseInt(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-[10px] text-gray-500 w-6 text-right">{(blockStyle[key] as number) || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Border Radius: <span className="text-indigo-600">{blockStyle.borderRadius || 0}px</span>
        </label>
        <input
          type="range"
          min={0}
          max={32}
          value={blockStyle.borderRadius || 0}
          onChange={(e) => onBlockStyleChange(targetId, 'borderRadius', parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Shadow */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Shadow</label>
        <select
          value={blockStyle.shadow || 'none'}
          onChange={(e) => onBlockStyleChange(targetId, 'shadow', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {SHADOW_PRESETS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Opacity: <span className="text-indigo-600">{blockStyle.opacity ?? 100}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={blockStyle.opacity ?? 100}
          onChange={(e) => onBlockStyleChange(targetId, 'opacity', parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>
    </div>
  );
}

// ============================================
// RIGHT PANEL: ADVANCED TAB
// ============================================

function AdvancedTab({
  section,
  block,
  blockStyle,
  onBlockStyleChange,
}: {
  section: Section;
  block: Block | null;
  blockStyle: BlockStyle;
  onBlockStyleChange: (blockId: string, key: keyof BlockStyle, value: unknown) => void;
}) {
  const targetId = block?.id || section.id;

  return (
    <div className="space-y-5">
      {/* CSS Classes */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">CSS Classes</label>
        <input
          type="text"
          value={blockStyle.cssClasses || ''}
          onChange={(e) => onBlockStyleChange(targetId, 'cssClasses', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
          placeholder="class-one class-two"
        />
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Visibility</label>
        <div className="space-y-2">
          {[
            { key: 'visibleDesktop' as const, label: 'Desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
            { key: 'visibleTablet' as const, label: 'Tablet', icon: <Tablet className="w-3.5 h-3.5" /> },
            { key: 'visibleMobile' as const, label: 'Mobile', icon: <Smartphone className="w-3.5 h-3.5" /> },
          ].map(vis => (
            <label key={vis.key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2 text-xs text-gray-700">
                {vis.icon}
                {vis.label}
              </div>
              <input
                type="checkbox"
                checked={blockStyle[vis.key] !== false}
                onChange={(e) => onBlockStyleChange(targetId, vis.key, e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Motion Effects */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Motion Effect</label>
        <select
          value={blockStyle.motionEffect || 'none'}
          onChange={(e) => onBlockStyleChange(targetId, 'motionEffect', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {MOTION_EFFECTS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Animation Delay */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Animation Delay: <span className="text-indigo-600">{blockStyle.animationDelay || 0}ms</span>
        </label>
        <input
          type="range"
          min={0}
          max={2000}
          step={100}
          value={blockStyle.animationDelay || 0}
          onChange={(e) => onBlockStyleChange(targetId, 'animationDelay', parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>
    </div>
  );
}

// ============================================
// GLOBAL STYLES PANEL
// ============================================

function GlobalStylesPanel({
  styles,
  onChange,
  onClose,
}: {
  styles: GlobalStyles;
  onChange: (styles: GlobalStyles) => void;
  onClose: () => void;
}) {
  const updateColor = (key: keyof GlobalStyles['colors'], value: string) => {
    onChange({ ...styles, colors: { ...styles.colors, [key]: value } });
  };

  const updateTypo = (key: keyof GlobalStyles['typography'], value: string | number) => {
    onChange({ ...styles, typography: { ...styles.typography, [key]: value } });
  };

  const updateButtons = (key: keyof GlobalStyles['buttons'], value: string | number) => {
    onChange({ ...styles, buttons: { ...styles.buttons, [key]: value } });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white">Global Styles</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Color Palette */}
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-500" /> Color Palette
          </h3>
          {(['primary', 'secondary', 'accent', 'text', 'background'] as const).map(key => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-xs font-medium text-gray-600 capitalize">{key}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styles.colors[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-7 h-7 rounded-md border border-gray-200 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-gray-400 w-16">{styles.colors[key]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-indigo-500" /> Typography
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Heading Font</label>
              <select
                value={styles.typography.headingFont}
                onChange={(e) => updateTypo('headingFont', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {FONT_FAMILIES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Body Font</label>
              <select
                value={styles.typography.bodyFont}
                onChange={(e) => updateTypo('bodyFont', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {FONT_FAMILIES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Base Font Size: <span className="text-indigo-600 font-semibold">{styles.typography.baseFontSize}px</span>
              </label>
              <input
                type="range"
                min={12}
                max={24}
                value={styles.typography.baseFontSize}
                onChange={(e) => updateTypo('baseFontSize', parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-500" /> Buttons
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Border Radius: <span className="text-indigo-600 font-semibold">{styles.buttons.borderRadius}px</span>
              </label>
              <input
                type="range"
                min={0}
                max={24}
                value={styles.buttons.borderRadius}
                onChange={(e) => updateButtons('borderRadius', parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Style</label>
              <div className="flex gap-1.5">
                {(['filled', 'outline', 'ghost'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => updateButtons('style', s)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                      styles.buttons.style === s
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Size</label>
              <div className="flex gap-1.5">
                {(['sm', 'md', 'lg'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => updateButtons('size', s)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all uppercase ${
                      styles.buttons.size === s
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spacing */}
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <MoveVertical className="w-3.5 h-3.5 text-indigo-500" /> Spacing
          </h3>
          <div className="flex gap-1.5">
            {(['compact', 'normal', 'spacious'] as const).map(s => (
              <button
                key={s}
                onClick={() => onChange({ ...styles, spacing: s })}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                  styles.spacing === s
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dark Mode */}
        <div className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            {styles.darkMode ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span className="text-xs font-semibold text-gray-700">Dark Mode</span>
          </div>
          <button
            onClick={() => onChange({ ...styles, darkMode: !styles.darkMode })}
            className={`w-10 h-5 rounded-full transition-all relative ${
              styles.darkMode ? 'bg-indigo-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
              styles.darkMode ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Animations */}
        <div className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">Animations</span>
          </div>
          <button
            onClick={() => onChange({ ...styles, animations: !styles.animations })}
            className={`w-10 h-5 rounded-full transition-all relative ${
              styles.animations ? 'bg-indigo-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
              styles.animations ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTextTag(variant: string): keyof JSX.IntrinsicElements {
  switch (variant) {
    case 'h1': return 'h1';
    case 'h2': return 'h2';
    case 'h3': return 'h3';
    case 'h4': return 'h4';
    case 'small': case 'caption': return 'small';
    default: return 'p';
  }
}

function getTextClassName(variant: string, section: Section, gs: GlobalStyles): string {
  const isDark = section.style?.darkMode || gs.darkMode;
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const bodyColor = isDark ? 'text-gray-300' : 'text-gray-600';

  switch (variant) {
    case 'h1': return `text-4xl md:text-5xl font-bold mb-4 ${textColor} leading-tight`;
    case 'h2': return `text-2xl md:text-3xl font-bold mb-3 ${textColor}`;
    case 'h3': return `text-xl font-semibold mb-2 ${textColor}`;
    case 'h4': return `text-lg font-semibold mb-2 ${textColor}`;
    case 'lead': return `text-lg ${bodyColor} mb-4 leading-relaxed`;
    case 'small': return `text-sm ${bodyColor}`;
    case 'caption': return `text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`;
    default: return `text-base ${bodyColor} mb-3 leading-relaxed`;
  }
}

function getButtonStyle(props: ButtonProps, accent: string, gs: GlobalStyles): React.CSSProperties {
  const radius = gs.buttons.borderRadius;
  const padMap = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' };
  const sizeMap = { sm: '13px', md: '14px', lg: '16px' };
  const padding = padMap[props.size || gs.buttons.size || 'md'];
  const fontSize = sizeMap[props.size || gs.buttons.size || 'md'];

  const base: React.CSSProperties = {
    borderRadius: `${radius}px`,
    padding,
    fontSize,
    fontWeight: 600,
    transition: 'all 0.15s ease',
    display: 'inline-block',
    lineHeight: '1.4',
  };

  switch (props.variant) {
    case 'primary':
      return { ...base, backgroundColor: accent, color: '#fff', border: 'none' };
    case 'secondary':
      return { ...base, backgroundColor: `${accent}15`, color: accent, border: `1px solid ${accent}30` };
    case 'outline':
      return { ...base, backgroundColor: 'transparent', color: accent, border: `2px solid ${accent}` };
    case 'ghost':
      return { ...base, backgroundColor: 'transparent', color: accent, border: 'none', textDecoration: 'underline' };
    default:
      return { ...base, backgroundColor: accent, color: '#fff', border: 'none' };
  }
}

function getSectionBackground(section: Section, accent: string, gs: GlobalStyles): React.CSSProperties {
  const isDark = section.style?.darkMode;
  const bg = section.style?.backgroundColor;

  if (isDark) {
    return { backgroundColor: '#1f2937', color: '#f9fafb' };
  }

  if (bg) {
    return { backgroundColor: bg };
  }

  // For hero sections, find first image and use as background
  if (section.type === 'hero') {
    const heroImage = section.blocks.find(b => b.type === 'image');
    if (heroImage && (heroImage.props as ImageProps).src) {
      return {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${(heroImage.props as ImageProps).src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };
    }
    return { backgroundColor: '#0a1628', color: '#ffffff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  }

  // Default backgrounds by section type
  switch (section.type) {
    case 'cta':
      return { background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`, color: '#ffffff' };
    case 'stats':
      return { backgroundColor: '#f9fafb' };
    case 'testimonials':
      return { backgroundColor: '#fafafa' };
    case 'services':
      return { background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' };
    case 'footer':
      return { backgroundColor: '#111827', color: '#9ca3af' };
    default:
      return {};
  }
}
