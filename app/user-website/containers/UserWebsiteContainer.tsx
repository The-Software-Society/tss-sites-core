'use client';

import React from 'react';
import RenderBlocks from '../blocks/RenderBlocks';
import { useBaseWebsiteContext } from '../globals/BaseWebsiteContextProvider';

/** Renders the active page's blocks inside the site chrome (header, menu, footer). */
export default function UserWebsiteContainer({ mode = 'live' }: { mode?: 'live' | 'preview' }) {
  const { state, dispatch } = useBaseWebsiteContext();
  const page = state?.pages?.find((p: any) => p.uuid === state?.activePage);
  return <RenderBlocks blocks={page?.blocks || []} state={state} dispatch={dispatch} mode={mode} />;
}
