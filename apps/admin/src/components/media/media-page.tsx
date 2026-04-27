'use client';

import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import { FileDetail } from './file-detail';
import { FolderTree } from './folder-tree';
import { MediaFilters } from './media-filters';
import { MediaGrid } from './media-grid';
import { UploadZone } from './upload-zone';
import { useMediaLibrary } from './use-media-library';

export function MediaPageClient(): JSX.Element {
  const t = useTranslations('mediaLibrary');
  const lib = useMediaLibrary();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[--color-border] px-6 py-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('description')}</p>
      </div>

      <MediaFilters
        search={lib.search}
        mimeType={lib.mimeType}
        sort={lib.sort}
        view={lib.view}
        setSearch={lib.setSearch}
        setMimeType={lib.setMimeType}
        setSort={lib.setSort}
        setView={lib.setView}
        setShowUpload={lib.setShowUpload}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 shrink-0 overflow-y-auto border-e border-[--color-border] p-3">
          <FolderTree
            folders={lib.folders}
            selectedId={lib.selectedFolderId}
            onSelect={lib.setSelectedFolderId}
            onCreate={lib.createFolder}
          />
        </aside>

        <main className="flex-1 overflow-y-auto p-4">
          <MediaGrid
            files={lib.files}
            view={lib.view}
            selected={lib.selected}
            onToggle={lib.toggleSelect}
            onFileClick={lib.selectFile}
            loading={lib.loading}
          />
        </main>

        {lib.selectedFile !== null && (
          <aside className="w-72 shrink-0 overflow-y-auto border-s border-[--color-border]">
            <FileDetail
              file={lib.selectedFile}
              onUpdate={lib.updateMeta}
              onTrash={lib.trashFile}
              onClose={() => {
                lib.setSelectedFile(null);
              }}
            />
          </aside>
        )}
      </div>

      {lib.showUpload && (
        <UploadZone
          onUpload={lib.upload}
          onUploadUrl={lib.uploadUrl}
          onClose={() => {
            lib.setShowUpload(false);
          }}
          uploading={lib.uploading}
        />
      )}
    </div>
  );
}
