import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import type { Page, Section, Block, SiteContent, SiteSettings } from '@builder/shared';

// Auth Store
interface User {
  id: string;
  email: string;
}

interface Tenant {
  id: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  subscription: { status: string; currentPeriodEnd: string } | null;
  setAuth: (token: string, user: User, tenant: Tenant) => void;
  setSubscription: (sub: { status: string; currentPeriodEnd: string } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      subscription: null,
      setAuth: (token, user, tenant) => set({ token, user, tenant }),
      setSubscription: (subscription) => set({ subscription }),
      logout: () => set({ token: null, user: null, tenant: null, subscription: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Editor Store
interface EditorState {
  pages: Page[];
  settings: SiteSettings | null;
  selectedPageIndex: number;
  selectedSectionId: string | null;
  history: Page[][];
  historyIndex: number;

  // Actions
  setContent: (content: SiteContent) => void;
  setSelectedPage: (index: number) => void;
  setSelectedSection: (id: string | null) => void;

  // Section operations
  addSection: (type: Section['type']) => void;
  deleteSection: (id: string) => void;
  moveSection: (id: string, direction: 'up' | 'down') => void;
  reorderSections: (pageIndex: number, fromIndex: number, toIndex: number) => void;

  // Block operations
  updateBlock: (sectionId: string, blockId: string, props: Partial<Block['props']>) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Save snapshot
  saveSnapshot: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultSection = (type: Section['type'], settings: SiteSettings): Section => {
  const id = generateId();

  switch (type) {
    case 'hero':
      return {
        id,
        type: 'hero',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `Welcome to ${settings.businessName}`, variant: 'h1' } },
          { id: generateId(), type: 'text', props: { content: 'Your trusted partner', variant: 'body' } },
          { id: generateId(), type: 'button', props: { text: 'Get Started', href: '#contact', variant: 'primary' } },
        ],
      };
    case 'about':
      return {
        id,
        type: 'about',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'About Us', variant: 'h2' } },
          { id: generateId(), type: 'text', props: { content: 'Learn more about our story and mission.', variant: 'body' } },
        ],
      };
    case 'services':
      return {
        id,
        type: 'services',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Our Services', variant: 'h2' } },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'Service 1', description: 'Description' },
            { id: generateId(), title: 'Service 2', description: 'Description' },
          ], layout: 'grid' } },
        ],
      };
    case 'testimonials':
      return {
        id,
        type: 'testimonials',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'What Our Clients Say', variant: 'h2' } },
          { id: generateId(), type: 'list', props: { items: [
            { id: generateId(), title: 'John D.', description: 'Great service!' },
          ], layout: 'list' } },
        ],
      };
    case 'contact':
      return {
        id,
        type: 'contact',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: 'Contact Us', variant: 'h2' } },
          { id: generateId(), type: 'text', props: { content: `Email: ${settings.contactEmail}`, variant: 'body' } },
          { id: generateId(), type: 'text', props: { content: `Phone: ${settings.contactPhone}`, variant: 'body' } },
        ],
      };
    case 'footer':
      return {
        id,
        type: 'footer',
        variant: 1,
        blocks: [
          { id: generateId(), type: 'text', props: { content: `© ${new Date().getFullYear()} ${settings.businessName}`, variant: 'small' } },
        ],
      };
    default:
      throw new Error(`Unknown section type: ${type}`);
  }
};

export const useEditorStore = create<EditorState>((set, get) => ({
  pages: [],
  settings: null,
  selectedPageIndex: 0,
  selectedSectionId: null,
  history: [],
  historyIndex: -1,

  setContent: (content) => set({
    pages: content.pages,
    settings: content.settings,
    history: [content.pages],
    historyIndex: 0,
  }),

  setSelectedPage: (index) => set({ selectedPageIndex: index, selectedSectionId: null }),

  setSelectedSection: (id) => set({ selectedSectionId: id }),

  addSection: (type) => set(produce((state: EditorState) => {
    if (!state.settings) return;
    const section = createDefaultSection(type, state.settings);
    const page = state.pages[state.selectedPageIndex];
    if (page) {
      // Insert before footer if exists
      const footerIndex = page.sections.findIndex(s => s.type === 'footer');
      if (footerIndex >= 0) {
        page.sections.splice(footerIndex, 0, section);
      } else {
        page.sections.push(section);
      }
      state.selectedSectionId = section.id;
    }
  })),

  deleteSection: (id) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (page) {
      const index = page.sections.findIndex(s => s.id === id);
      if (index >= 0) {
        page.sections.splice(index, 1);
        state.selectedSectionId = null;
      }
    }
  })),

  moveSection: (id, direction) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (!page) return;

    const index = page.sections.findIndex(s => s.id === id);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= page.sections.length) return;

    const [section] = page.sections.splice(index, 1);
    page.sections.splice(newIndex, 0, section);
  })),

  reorderSections: (pageIndex, fromIndex, toIndex) => set(produce((state: EditorState) => {
    const page = state.pages[pageIndex];
    if (!page) return;

    const [section] = page.sections.splice(fromIndex, 1);
    page.sections.splice(toIndex, 0, section);
  })),

  updateBlock: (sectionId, blockId, props) => set(produce((state: EditorState) => {
    const page = state.pages[state.selectedPageIndex];
    if (!page) return;

    const section = page.sections.find(s => s.id === sectionId);
    if (!section) return;

    const block = section.blocks.find(b => b.id === blockId);
    if (!block) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    block.props = { ...block.props, ...props } as any;
  })),

  saveSnapshot: () => set(produce((state: EditorState) => {
    // Remove any future history
    state.history = state.history.slice(0, state.historyIndex + 1);
    // Add current state
    state.history.push(JSON.parse(JSON.stringify(state.pages)));
    state.historyIndex = state.history.length - 1;
    // Limit history size
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIndex--;
    }
  })),

  undo: () => set(produce((state: EditorState) => {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.pages = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }
  })),

  redo: () => set(produce((state: EditorState) => {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      state.pages = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    }
  })),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));

// Wizard Store
interface WizardState {
  step: number;
  data: Partial<SiteSettings>;
  setStep: (step: number) => void;
  updateData: (data: Partial<SiteSettings>) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  data: {},
  setStep: (step) => set({ step }),
  updateData: (data) => set((state) => ({ data: { ...state.data, ...data } })),
  reset: () => set({ step: 1, data: {} }),
}));
