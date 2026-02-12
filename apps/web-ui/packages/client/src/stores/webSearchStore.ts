/**
 * Web Search Store - Manages search results state
 */
import { create } from 'zustand';

export interface SearchResult {
  pageid: number;
  title: string;
  snippet: string;
  wordcount: number;
  url: string;
  tags: string[];
}

export interface DuckDuckGoResult {
  title: string;
  url: string;
  snippet: string;
  displayUrl?: string;
  tags: string[];
}

export type WebSearchViewMode = 'hidden' | 'results';
export type WebSearchModalSize = 'minimized' | 'normal' | 'maximized';

interface WebSearchState {
  // Modal state
  viewMode: WebSearchViewMode;
  modalSize: WebSearchModalSize;
  
  // Content state
  searchResults: SearchResult[];
  duckduckgoResults: DuckDuckGoResult[];
  searchQuery: string | null;
  totalHits: number;
  suggestion: string | null;
  
  // Actions
  showResults: (
    query: string,
    results: SearchResult[],
    totalHits: number,
    suggestion?: string,
    duckduckgoResults?: DuckDuckGoResult[]
  ) => void;
  setModalSize: (size: WebSearchModalSize) => void;
  toggleSize: () => void;
  hide: () => void;
  clear: () => void;
}

export const useWebSearchStore = create<WebSearchState>((set, get) => ({
  // Initial state
  viewMode: 'hidden',
  modalSize: 'normal',
  searchResults: [],
  duckduckgoResults: [],
  searchQuery: null,
  totalHits: 0,
  suggestion: null,

  // Show search results
  showResults: (
    query: string,
    results: SearchResult[],
    totalHits: number,
    suggestion?: string,
    duckduckgoResults: DuckDuckGoResult[] = []
  ) => {
    set({
      viewMode: 'results',
      modalSize: 'maximized',
      searchQuery: query,
      searchResults: results,
      totalHits,
      suggestion: suggestion || null,
      duckduckgoResults,
    });
  },

  // Set modal size
  setModalSize: (size: WebSearchModalSize) => {
    set({ modalSize: size });
  },

  // Toggle between minimized and maximized
  toggleSize: () => {
    const { modalSize } = get();
    if (modalSize === 'minimized') {
      set({ modalSize: 'maximized' });
    } else {
      set({ modalSize: 'minimized' });
    }
  },

  // Hide the modal
  hide: () => {
    set({ viewMode: 'hidden' });
  },

  // Clear all results
  clear: () => {
    set({
      searchResults: [],
      duckduckgoResults: [],
      searchQuery: null,
      totalHits: 0,
      suggestion: null,
    });
  },
}));
