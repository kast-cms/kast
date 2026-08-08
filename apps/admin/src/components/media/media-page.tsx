'use client';

import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
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
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

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

      {/* Rails stick to the top of the scroll area so browsing a long library
          never leaves the folder tree or the inspector behind. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className="shrink-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:w-52 lg:overflow-y-auto">
          <Card className="p-2">
            <FolderTree
              folders={lib.folders}
              selectedId={lib.selectedFolderId}
              onSelect={lib.setSelectedFolderId}
              onCreate={lib.createFolder}
            />
          </Card>
        </aside>

        <section className="min-w-0 flex-1">
          <MediaGrid
            files={lib.files}
            view={lib.view}
            selected={lib.selected}
            onToggle={lib.toggleSelect}
            onFileClick={lib.selectFile}
            loading={lib.loading}
          />
        </section>

        {lib.selectedFile !== null && (
          <aside className="shrink-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:w-72 lg:overflow-y-auto xl:w-80">
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
