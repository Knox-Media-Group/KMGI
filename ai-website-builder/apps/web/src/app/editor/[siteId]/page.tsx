'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, useEditorStore } from '@/lib/store';
import { sitesApi } from '@/lib/api';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Block, TextProps, ImageProps, ButtonProps, ListProps, SiteContent } from '@builder/shared';
import { SECTION_LIBRARY } from '@builder/shared';

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
    try {
      await sitesApi.saveDraft(siteId, pages, token);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading editor...</div>
      </div>
    );
  }

  const currentPage = pages[selectedPageIndex];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Editor Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-medium">{settings?.businessName}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Page Tabs */}
            {pages.map((page, index) => (
              <button
                key={page.slug}
                onClick={() => setSelectedPage(index)}
                className={`px-4 py-2 rounded-lg ${
                  selectedPageIndex === index
                    ? 'bg-gray-100 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {page.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                ↩
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                title="Redo (Ctrl+Shift+Z)"
              >
                ↪
              </button>
            </div>

            {/* Save Status */}
            <span className="text-sm text-gray-500">
              {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
            </span>

            <Link href="/dashboard" className="btn-primary text-base py-2 px-4">
              Done
            </Link>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex flex-1">
        {/* Main Canvas */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
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
                      accentColor={settings?.accentColor || '#2563EB'}
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
            <div className="p-8 border-t border-dashed border-gray-300 text-center">
              <button
                onClick={() => setShowSectionPicker(true)}
                className="inline-flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
              >
                <span className="text-2xl">+</span>
                Add Section
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Section Picker Modal */}
      {showSectionPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Section</h2>
              <button
                onClick={() => setShowSectionPicker(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SECTION_LIBRARY.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddSection(item.type)}
                  className="p-4 text-left rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
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
        className={`absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg shadow-sm border px-2 py-1 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity z-10`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <button onClick={onMoveUp} className="p-1 text-gray-400 hover:text-gray-600" title="Move up">
          ↑
        </button>
        <button onClick={onMoveDown} className="p-1 text-gray-400 hover:text-gray-600" title="Move down">
          ↓
        </button>
        <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600" title="Delete">
          ×
        </button>
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
          <img
            src={props.src || '/placeholder-image.jpg'}
            alt={props.alt}
            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleImageClick}
            title="Click to replace image"
          />
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
            className={`inline-block px-8 py-4 text-lg font-semibold rounded-lg cursor-text ${
              props.variant === 'primary' ? '' : 'border-2'
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
            <li key={item.id} className="p-4 bg-gray-50 rounded-lg">
              <div
                contentEditable
                suppressContentEditableWarning
                className="font-semibold outline-none"
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
                className="text-gray-600 text-sm mt-1 outline-none"
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
      return 'text-4xl font-bold mb-4';
    case 'h2':
      return 'text-3xl font-bold mb-4';
    case 'h3':
      return 'text-xl font-bold mb-2';
    case 'small':
      return 'text-sm text-gray-500';
    default:
      return 'text-gray-600 mb-4';
  }
}
