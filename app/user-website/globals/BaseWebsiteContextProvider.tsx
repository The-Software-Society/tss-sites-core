'use client';

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { MediaItem, Page, Website } from '@/app/lib/sites/types';

/**
 * Website rendering state, shared by every block.
 *
 * The platform's provider also owns the cart, the visitor's account, forms and
 * live collection data, all loaded from the database on the client. A site in
 * this project is plain data handed down from the server, so the provider only
 * has to hold it: the website record, its media library and its pages. Blocks
 * read it through the same `useBaseWebsiteContext()` hook the platform uses, so
 * block code ports across unchanged.
 */
export interface BaseWebsiteState {
  website: Website;
  allMedia: MediaItem[];
  pages: Page[];
  activePage?: string;
}

type Action = { type: 'replace'; state: BaseWebsiteState };

function reducer(state: BaseWebsiteState, action: Action): BaseWebsiteState {
  switch (action.type) {
    case 'replace': return action.state;
    default: return state;
  }
}

interface ContextValue {
  // Blocks read loosely typed settings and content, as on the platform.
  state: any;
  dispatch: React.Dispatch<Action>;
}

const BaseWebsiteContext = createContext<ContextValue>({ state: null, dispatch: () => {} });

export function useBaseWebsiteContext(): ContextValue {
  return useContext(BaseWebsiteContext);
}

export default function BaseWebsiteContextProvider({ initialState, children }: {
  initialState: BaseWebsiteState;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <BaseWebsiteContext.Provider value={value}>{children}</BaseWebsiteContext.Provider>;
}
