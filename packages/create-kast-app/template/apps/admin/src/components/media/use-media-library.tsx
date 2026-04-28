'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type {
  MediaFileDetail,
  MediaFileSummary,
  MediaFolder,
  MediaListParams,
} from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseMediaLibraryReturn {
  files: MediaFileSummary[];
  folders: MediaFolder[];
  selectedFile: MediaFileDetail | null;
  selectedFolderId: string | null;
  selected: Set<string>;
  search: string;
  mimeType: string;
  sort: string;
  view: 'grid' | 'list';
  loading: boolean;
  uploading: boolean;
  showUpload: boolean;
  setSearch: (v: string) => void;
  setMimeType: (v: string) => void;
  setSort: (v: string) => void;
  setView: (v: 'grid' | 'list') => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedFile: (file: MediaFileDetail | null) => void;
  setShowUpload: (v: boolean) => void;
  toggleSelect: (id: string) => void;
  selectFile: (file: MediaFileSummary) => void;
  upload: (files: File[]) => void;
  uploadUrl: (url: string) => void;
  updateMeta: (id: string, altText: string) => void;
  trashFile: (id: string) => void;
  createFolder: (name: string, parentId?: string) => void;
}

export function useMediaLibrary(): UseMediaLibraryReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [files, setFiles] = useState<MediaFileSummary[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaFileDetail | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const loadFolders = useCallback(async () => {
    const res = await client.media.listFolders();
    setFolders(res.data);
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: MediaListParams = {};
      if (search) params.search = search;
      if (mimeType) params.mimeType = mimeType;
      if (sort) params.sort = sort;
      if (selectedFolderId) params.folderId = selectedFolderId;
      const res = await client.media.list(params);
      setFiles(res.data);
    } finally {
      setLoading(false);
    }
  }, [search, mimeType, sort, selectedFolderId]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);
  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFile(file: MediaFileSummary): void {
    void client.media.get(file.id).then((res) => {
      setSelectedFile(res.data);
    });
  }

  function upload(fileList: File[]): void {
    void (async () => {
      setUploading(true);
      try {
        for (const file of fileList) {
          const fd = new FormData();
          fd.append('file', file);
          if (selectedFolderId) fd.append('folderId', selectedFolderId);
          await client.media.upload(fd);
        }
        void loadFiles();
      } finally {
        setUploading(false);
      }
    })();
  }

  function uploadUrl(url: string): void {
    void (async () => {
      setUploading(true);
      try {
        const body = selectedFolderId ? { url, folderId: selectedFolderId } : { url };
        await client.media.uploadUrl(body);
        void loadFiles();
      } finally {
        setUploading(false);
      }
    })();
  }

  function updateMeta(id: string, altText: string): void {
    void client.media.update(id, { altText }).then(() => {
      void loadFiles();
    });
  }

  function trashFile(id: string): void {
    void client.media.trash(id).then(() => {
      setSelectedFile(null);
      void loadFiles();
    });
  }

  function createFolder(name: string, parentId?: string): void {
    const body = parentId !== undefined ? { name, parentId } : { name };
    void client.media.createFolder(body).then(() => {
      void loadFolders();
    });
  }

  return {
    files,
    folders,
    selectedFile,
    selectedFolderId,
    selected,
    search,
    mimeType,
    sort,
    view,
    loading,
    uploading,
    showUpload,
    setSearch,
    setMimeType,
    setSort,
    setView,
    setSelectedFolderId,
    setSelectedFile,
    setShowUpload,
    toggleSelect,
    selectFile,
    upload,
    uploadUrl,
    updateMeta,
    trashFile,
    createFolder,
  };
}
