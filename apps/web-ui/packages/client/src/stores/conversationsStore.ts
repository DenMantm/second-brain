import { create } from 'zustand';

interface ConversationsState {
  isOpen: boolean;
  modalSize: 'minimized' | 'maximized';
  
  show: () => void;
  hide: () => void;
  toggleSize: () => void;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  isOpen: false,
  modalSize: 'maximized',
  
  show: () => set({ isOpen: true }),
  
  hide: () => set({ isOpen: false }),
  
  toggleSize: () => set((state) => ({
    modalSize: state.modalSize === 'minimized' ? 'maximized' : 'minimized'
  })),
}));
