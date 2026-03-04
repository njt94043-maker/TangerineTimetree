
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
// The createPageUrl utility is no longer directly used for auth redirect but might be used elsewhere.
// Keeping it as it's an existing import and not directly tied to the auth removal itself.
// However, the specific usage within the removed useEffect is gone.
// import { createPageUrl } from "@/utils"; // Removed as it's no longer used after auth check removal.
import VideoUploadForm from "../components/media/VideoUploadForm";
import VideoGrid from "../components/media/VideoGrid";

export default function ManageVideos() {
  const navigate = useNavigate(); // Still used if other navigation paths exist, even without auth checks.
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);

  // Removed auth check - app is now public.
  // The original useEffect for authentication has been completely removed.
  /*
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        if (user.role !== 'admin') {
          navigate(createPageUrl("Home"));
        }
      } catch (error) {
        await base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    checkAuth();
  }, [navigate]);
  */

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_date'),
    initialData: [],
  });

  const createVideoMutation = useMutation({
    mutationFn: (videoData) => base44.entities.Video.create(videoData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setShowUploadForm(false);
      setEditingVideo(null);
    },
  });

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, videoData }) => base44.entities.Video.update(id, videoData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setShowUploadForm(false);
      setEditingVideo(null);
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (id) => base44.entities.Video.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  const handleSubmit = (videoData) => {
    if (editingVideo) {
      updateVideoMutation.mutate({ id: editingVideo.id, videoData });
    } else {
      createVideoMutation.mutate(videoData);
    }
  };

  const handleEdit = (video) => {
    setEditingVideo(video);
    setShowUploadForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this video? It will be removed from the public gallery.')) {
      deleteVideoMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Manage Videos</h1>
            <p className="text-gray-400">Upload and manage videos for the public gallery</p>
          </div>
          <Button
            onClick={() => {
              setEditingVideo(null);
              setShowUploadForm(true);
            }}
            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Video
          </Button>
        </div>

        {showUploadForm && (
          <VideoUploadForm
            video={editingVideo}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowUploadForm(false);
              setEditingVideo(null);
            }}
            isSubmitting={createVideoMutation.isPending || updateVideoMutation.isPending}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : (
          <VideoGrid
            videos={videos}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={deleteVideoMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
