import { useState, useEffect, useRef } from 'react';
import { getAllMedia, createMediaEntry, updateMediaEntry, deleteMediaEntry } from '@shared/supabase/queries';
import { supabase } from '../supabase/client';
import type { PublicMedia } from '@shared/supabase/types';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmModal } from './ConfirmModal';

interface MediaManagerProps {
  onClose: () => void;
}

function extractYouTubeEmbedUrl(url: string): string {
  // Convert various YouTube URL formats to embed URLs
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const match = url.match(pat);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
}

function getThumbnailFromUrl(url: string, mediaType: 'photo' | 'video'): string {
  if (mediaType === 'video') {
    const match = url.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return url;
}

export function MediaManager({ onClose }: MediaManagerProps) {
  const [media, setMedia] = useState<PublicMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<PublicMedia | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    try {
      const data = await getAllMedia();
      setMedia(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);

      const ext = file.name.split('.').pop() || 'jpg';
      const path = `gallery/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('public-media')
        .upload(path, file, { cacheControl: '31536000', upsert: false });

      if (uploadError) {
        setUploadProgress(`Error uploading ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from('public-media').getPublicUrl(path);

      await createMediaEntry({
        media_type: 'photo',
        url: urlData.publicUrl,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      });
    }

    setUploadProgress('');
    setUploading(false);
    loadMedia();
  }

  async function handleAddVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    const embedUrl = extractYouTubeEmbedUrl(videoUrl.trim());
    const thumbUrl = getThumbnailFromUrl(videoUrl.trim(), 'video');

    await createMediaEntry({
      media_type: 'video',
      url: videoUrl.trim(),
      video_embed_url: embedUrl,
      thumbnail_url: thumbUrl,
      title: videoTitle.trim() || 'Video',
    });

    setVideoUrl('');
    setVideoTitle('');
    loadMedia();
  }

  async function handleToggleVisibility(item: PublicMedia) {
    await updateMediaEntry(item.id, { visible: !item.visible });
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, visible: !m.visible } : m));
  }

  async function handleDelete(item: PublicMedia) {
    // If it's a Supabase Storage URL, try to delete the file too
    if (item.media_type === 'photo' && item.url.includes('public-media')) {
      const pathMatch = item.url.match(/public-media\/(.+)/);
      if (pathMatch) {
        await supabase.storage.from('public-media').remove([pathMatch[1]]);
      }
    }

    await deleteMediaEntry(item.id);
    setMedia(prev => prev.filter(m => m.id !== item.id));
  }

  async function handleTitleBlur(item: PublicMedia, newTitle: string) {
    if (newTitle !== item.title) {
      await updateMediaEntry(item.id, { title: newTitle });
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }

  return (
    <div className="media-manager">
      <div className="page-header">
        <h2>Media Manager</h2>
        <button className="btn btn-small" onClick={onClose}>Back</button>
      </div>

      {/* Upload area */}
      <div
        className={`media-upload-area ${dragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="media-upload-label">Drag & drop photos, or</p>
        <div className="media-upload-btns">
          <button
            className="btn btn-green btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Choose Photos'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="media-upload-input"
            onChange={e => handleFileUpload(e.target.files)}
          />
        </div>
        {uploadProgress && <p className="media-upload-progress">{uploadProgress}</p>}
      </div>

      {/* Add video */}
      <form className="media-video-form" onSubmit={handleAddVideo}>
        <input
          className="ps-form-input media-video-url"
          type="url"
          placeholder="YouTube URL..."
          value={videoUrl}
          onChange={e => setVideoUrl(e.target.value)}
        />
        <input
          className="ps-form-input media-video-title"
          type="text"
          placeholder="Title"
          value={videoTitle}
          onChange={e => setVideoTitle(e.target.value)}
        />
        <button className="btn btn-tangerine btn-small" type="submit" disabled={!videoUrl.trim()}>
          Add Video
        </button>
      </form>

      {/* Media grid */}
      {loading ? (
        <LoadingSpinner text="Loading media..." />
      ) : media.length === 0 ? (
        <p className="media-empty">No media yet. Upload photos or add video links above.</p>
      ) : (
        <div className="media-grid-manage">
          {media.map(item => (
            <div key={item.id} className={`media-card-manage ${!item.visible ? 'hidden-media' : ''}`}>
              {item.media_type === 'photo' ? (
                <img
                  src={item.url}
                  alt={item.title}
                  className="media-card-img"
                  loading="lazy"
                />
              ) : (
                <>
                  <img
                    src={item.thumbnail_url || getThumbnailFromUrl(item.video_embed_url || item.url, 'video')}
                    alt={item.title}
                    className="media-card-img"
                    loading="lazy"
                  />
                  <span className="media-card-video-badge">VIDEO</span>
                </>
              )}
              <div className="media-card-body">
                <input
                  className="media-card-title-input"
                  defaultValue={item.title}
                  placeholder="Add title..."
                  onBlur={e => handleTitleBlur(item, e.target.value)}
                />
                <div className="media-card-actions">
                  <button
                    className="media-card-action toggle-vis"
                    onClick={() => handleToggleVisibility(item)}
                  >
                    {item.visible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="media-card-action delete-media"
                    onClick={() => setConfirmDeleteItem(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDeleteItem && (
        <ConfirmModal
          message="Delete this media item?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { handleDelete(confirmDeleteItem); setConfirmDeleteItem(null); }}
          onCancel={() => setConfirmDeleteItem(null)}
        />
      )}
    </div>
  );
}
