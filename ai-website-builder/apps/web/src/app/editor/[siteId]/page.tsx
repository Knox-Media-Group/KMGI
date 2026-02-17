'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Check,
  Loader2,
  Plus,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  X,
  Sparkles,
  Layout,
  MessageSquare,
  Star,
  Users,
  Phone,
  Image as ImageIcon,
  FileText,
  Target,
  List,
  Bot,
} from 'lucide-react';
import { AICopilot } from '@/components/AICopilot';
import type { CopilotAction } from '@/lib/api';
import { useAuthStore, useEditorStore } from '@/lib/store';
import { sitesApi } from '@/lib/api';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Block, TextProps, ImageProps, ButtonProps, ListProps, SiteContent } from '@builder/shared';
import { SECTION_LIBRARY } from '@builder/shared';

// Section type icons mapping
const SECTION_ICONS: Record<string, React.ReactNode> = {
  hero: <Layout className="w-5 h-5" />,
  about: <FileText className="w-5 h-5" />,
  services: <Target className="w-5 h-5" />,
  features: <Star className="w-5 h-5" />,
  testimonials: <MessageSquare className="w-5 h-5" />,
  team: <Users className="w-5 h-5" />,
  contact: <Phone className="w-5 h-5" />,
  gallery: <ImageIcon className="w-5 h-5" />,
  cta: <Target className="w-5 h-5" />,
  faq: <List className="w-5 h-5" />,
};

export default function EditorPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const { token, tenant } = useAuthStore();
  const {
    pages,
    settings,
    selectedPageIndex,
    selectedSectionId,
    setContent,
    setSelectedPage,
    setSelectedSection,
    addSection,
    deleteSection,
    moveSection,
    reorderSections,
    updateBlock,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showCopilot, setShowCopilot] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (pages.length === 0) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [pages, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const page = pages[selectedPageIndex];
      if (!page) return;

      const oldIndex = page.sections.findIndex((s) => s.id === active.id);
      const newIndex = page.sections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSections(selectedPageIndex, oldIndex, newIndex);
        saveSnapshot();
      }
    }
  };

  const handleAddSection = (type: Section['type']) => {
    addSection(type);
    setShowSectionPicker(false);
    saveSnapshot();
  };

  const handleDeleteSection = (id: string) => {
    if (confirm('Delete this section?')) {
      deleteSection(id);
      saveSnapshot();
    }
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
    // Handle other action types as needed
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow animate-pulse-glow">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Loading editor...</p>
        </div>
      </div>
    );
  }

  const currentPage = pages[selectedPageIndex];
  const selectedSection = currentPage?.sections.find(s => s.id === selectedSectionId);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Editor Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back + Site name */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">{settings?.businessName}</span>
            </div>
          </div>

          {/* Center: Page Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {pages.map((page, index) => (
              <button
                key={page.slug}
                onClick={() => setSelectedPage(index)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedPageIndex === index
                    ? 'bg-white text-gray-900 shadow-soft'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {page.title}
              </button>
            ))}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Save Status */}
            <div className="flex items-center gap-2 text-sm">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-2 text-emerald-600">
                  <Check className="w-4 h-4" />
                  Saved
                </span>
              )}
              {saveStatus === 'idle' && lastSaved && (
                <span className="text-gray-400 hidden sm:block">
                  Last saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Manual Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-ghost"
              title="Save (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
            </button>

            {/* AI Co-Pilot Button */}
            <button
              onClick={() => setShowCopilot(!showCopilot)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                showCopilot
                  ? 'bg-purple-600 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
              }`}
              title="AI Co-Pilot"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">AI Co-Pilot</span>
            </button>

            {/* Done Button */}
            <Link href="/dashboard" className="btn-primary">
              Done
            </Link>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex flex-1">
        {/* Main Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Canvas Container */}
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden border border-gray-100">
              {currentPage && (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={currentPage.sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {currentPage.sections.map((section) => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        isSelected={selectedSectionId === section.id}
                        accentColor={settings?.accentColor || '#8B5CF6'}
                        onSelect={() => setSelectedSection(section.id)}
                        onDelete={() => handleDeleteSection(section.id)}
                        onMoveUp={() => {
                          moveSection(section.id, 'up');
                          saveSnapshot();
                        }}
                        onMoveDown={() => {
                          moveSection(section.id, 'down');
                          saveSnapshot();
                        }}
                        onBlockChange={handleBlockChange}
                        onBlockBlur={handleBlockBlur}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Add Section Button */}
              <div className="p-8 border-t border-dashed border-gray-200 text-center bg-gray-50/50">
                <button
                  onClick={() => setShowSectionPicker(true)}
                  className="inline-flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-300 transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-purple-100">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Add Section</span>
                </button>
              </div>
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-400 mt-4">
              Click on any text to edit. Drag sections to reorder.
            </p>
          </div>
        </main>
      </div>

      {/* Section Picker Modal */}
      {showSectionPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 animate-slide-up overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Section</h2>
                <p className="text-sm text-gray-500 mt-1">Choose a section type to add to your page</p>
              </div>
              <button
                onClick={() => setShowSectionPicker(false)}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SECTION_LIBRARY.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleAddSection(item.type)}
                    className="p-4 text-left rounded-xl border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 bg-gray-100 group-hover:bg-purple-100 rounded-lg flex items-center justify-center mb-3 transition-colors">
                      <span className="text-gray-500 group-hover:text-purple-600">
                        {SECTION_ICONS[item.type] || <Layout className="w-5 h-5" />}
                      </span>
                    </div>
                    <div className="font-semibold text-gray-900 group-hover:text-purple-700 mb-1">
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Co-Pilot Panel */}
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

// Sortable Section Component
function SortableSection({
  section,
  isSelected,
  accentColor,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onBlockChange,
  onBlockBlur,
}: {
  section: Section;
  isSelected: boolean;
  accentColor: string;
  onSelect: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-section relative group ${isSelected ? 'selected' : ''} section-${section.type}`}
      onClick={onSelect}
    >
      {/* Section Controls */}
      <div
        className={`absolute top-3 right-3 flex items-center gap-1 bg-white rounded-xl shadow-medium border border-gray-100 px-2 py-1.5 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-all duration-200 z-10`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 text-gray-400 hover:text-gray-600 cursor-grab hover:bg-gray-50 rounded-lg transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          title="Move up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          title="Move down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete section"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Section Type Label */}
      <div
        className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-soft border border-gray-100 text-xs font-medium text-gray-500 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-all duration-200 z-10`}
      >
        {SECTION_ICONS[section.type] || <Layout className="w-3.5 h-3.5" />}
        <span className="capitalize">{section.type}</span>
      </div>

      {/* Section Content */}
      <div className="max-w-3xl mx-auto">
        {section.blocks.map((block) => (
          <EditableBlock
            key={block.id}
            block={block}
            sectionId={section.id}
            accentColor={accentColor}
            onChange={onBlockChange}
            onBlur={onBlockBlur}
          />
        ))}
      </div>
    </div>
  );
}

// Editable Block Component
function EditableBlock({
  block,
  sectionId,
  accentColor,
  onChange,
  onBlur,
}: {
  block: Block;
  sectionId: string;
  accentColor: string;
  onChange: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;
  onBlur: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  switch (block.type) {
    case 'text': {
      const props = block.props as TextProps;
      const Tag = getTextTag(props.variant);
      const className = getTextClassName(props.variant);

      return (
        <Tag
          contentEditable
          suppressContentEditableWarning
          className={`editor-block ${className} outline-none`}
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

      const handleImageClick = () => {
        fileInputRef.current?.click();
      };

      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            onChange(sectionId, block.id, { src: dataUrl });
            onBlur();
          };
          reader.readAsDataURL(file);
        }
      };

      return (
        <div className="editor-block my-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="relative group/image">
            <img
              src={props.src || '/placeholder-image.jpg'}
              alt={props.alt}
              className="max-w-full h-auto rounded-xl cursor-pointer transition-all duration-200 group-hover/image:opacity-80"
              onClick={handleImageClick}
            />
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 group-hover/image:opacity-100 transition-opacity cursor-pointer"
              onClick={handleImageClick}
            >
              <div className="bg-white px-4 py-2 rounded-lg shadow-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Replace Image</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'button': {
      const props = block.props as ButtonProps;
      const bgColor = props.variant === 'primary' ? accentColor : 'transparent';
      const textColor = props.variant === 'primary' ? '#ffffff' : accentColor;
      const borderColor = accentColor;

      return (
        <div className="editor-block my-4">
          <span
            contentEditable
            suppressContentEditableWarning
            className={`inline-block px-8 py-4 text-lg font-semibold rounded-xl cursor-text transition-all duration-200 ${
              props.variant === 'primary' ? 'shadow-soft' : 'border-2'
            }`}
            style={{ backgroundColor: bgColor, color: textColor, borderColor }}
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

      return (
        <ul className={`editor-block my-4 ${props.layout === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-4'}`}>
          {props.items.map((item, index) => (
            <li key={item.id} className="p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors">
              <div
                contentEditable
                suppressContentEditableWarning
                className="font-semibold text-gray-900 outline-none"
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
                className="text-gray-600 text-sm mt-2 outline-none"
                onBlur={(e) => {
                  const newItems = [...props.items];
                  newItems[index] = { ...item, description: e.currentTarget.textContent || '' };
                  onChange(sectionId, block.id, { items: newItems });
                  onBlur();
                }}
              >
                {item.description}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    default:
      return null;
  }
}

function getTextTag(variant: string): keyof JSX.IntrinsicElements {
  switch (variant) {
    case 'h1':
      return 'h1';
    case 'h2':
      return 'h2';
    case 'h3':
      return 'h3';
    case 'small':
      return 'small';
    default:
      return 'p';
  }
}

function getTextClassName(variant: string): string {
  switch (variant) {
    case 'h1':
      return 'text-4xl font-bold mb-4 text-gray-900';
    case 'h2':
      return 'text-3xl font-bold mb-4 text-gray-900';
    case 'h3':
      return 'text-xl font-semibold mb-2 text-gray-900';
    case 'small':
      return 'text-sm text-gray-500';
    default:
      return 'text-gray-600 mb-4 leading-relaxed';
  }
}
