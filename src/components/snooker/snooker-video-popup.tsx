"use client";

import { useState, useEffect } from "react";

interface VideoHighlight {
  id: string;
  title: string;
  thumbnail: string;
  author?: string;
}

interface SnookerVideoPopupProps {
  query: string;
  onClose: () => void;
}

export function SnookerVideoPopup({ query, onClose }: SnookerVideoPopupProps) {
  const [videos, setVideos] = useState<VideoHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/snooker/highlights?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) {
          setVideos(data.videos ?? []);
          if (data.videos?.length > 0) setSelectedVideo(data.videos[0].id);
        }
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900 truncate">Highlights</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Fermer">
            <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video player */}
        <div className="relative aspect-video bg-black">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          ) : selectedVideo ? (
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo}?rel=0`}
              className="h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <path d="M17 2l-5 5-5-5" />
              </svg>
              <span className="text-xs">Aucun highlight trouvé</span>
            </div>
          )}
        </div>

        {/* Video list */}
        {videos.length > 1 && (
          <div className="max-h-32 overflow-y-auto border-t border-gray-100">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVideo(v.id)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 ${
                  selectedVideo === v.id ? "bg-gray-50" : ""
                }`}
              >
                <img src={v.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">{v.title}</p>
                  {v.author && <p className="truncate text-[10px] text-gray-500">{v.author}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Query */}
        <div className="border-t border-gray-100 px-4 py-2">
          <p className="text-[10px] text-gray-400 truncate">Recherche: {query}</p>
        </div>
      </div>
    </div>
  );
}
